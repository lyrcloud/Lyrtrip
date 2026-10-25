// ---------------------------------------------------------------------------
// Partner shipping: stores Lyrcloud runs (Lyrshop) ship their orders through Lyrtrip.
// Easyship parcel rates and labels, and same-day couriers (Uber Direct / DoorDash Drive), are
// billed to the partner's account (a ledger settled between the businesses) instead of a card.
//
// Each partner calls with `authorization: Bearer <key>`; keys come from the environment:
//   LYRSHOP_PARTNER_KEY        the key Lyrshop sends (blank turns the partner API off)
//   LYRSHOP_SHIP_MARKUP        multiplier on Easyship's charge, default 1 (at cost)
//   LYRSHOP_DELIVERY_MARKUP    multiplier on the courier fee, default 1 (at cost)
//
// Labels and couriers are keyed by the partner's own order reference, so a retried call never buys twice.
// The search Lambda passes in the Easyship and courier helpers it already uses for Lyrtrip's own customers.
// ---------------------------------------------------------------------------

import { createHash, timingSafeEqual } from 'node:crypto';

const PARTNERS = { lyrshop: { key: 'LYRSHOP_PARTNER_KEY', ship: 'LYRSHOP_SHIP_MARKUP', delivery: 'LYRSHOP_DELIVERY_MARKUP' } };
const REFERENCE = /^[A-Za-z0-9_.:-]{1,80}$/;
const LEDGER_LIMIT = 500;

const digest = v => createHash('sha256').update(String(v)).digest();

// The partner whose key signed the request, or null
export function partnerFor(event, env = process.env) {
  const headers = Object.fromEntries(Object.entries(event.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const auth = String(headers.authorization ?? '');
  if (!auth.startsWith('Bearer ')) return null;
  const sent = digest(auth.slice(7).trim());
  for (const [name, spec] of Object.entries(PARTNERS)) {
    const key = env[spec.key];
    if (key && key.length >= 24 && timingSafeEqual(sent, digest(key))) return name;
  }
  return null;
}

const markup = (env, partner, kind) => {
  const value = Number(env[PARTNERS[partner][kind]] || 1);
  return value >= 1 && value <= 2 ? value : 1;
};

export const isPartnerRoute = path => path.includes('/api/partner/');

export async function handlePartner(event, deps, env = process.env) {
  const { json } = deps;
  const partner = partnerFor(event, env);
  if (!partner) return json(401, { error: 'Unknown partner key' });
  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body ?? {});
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const route = (event.rawPath || event.path || '').split('/api/partner/')[1] ?? '';
  const ctx = { ...deps, partner, env, now: deps.now ?? (() => new Date()) };
  switch (route) {
    case 'ship/rates':       return shipRates(ctx, body);
    case 'ship/label':       return shipLabel(ctx, body);
    case 'ship/status':      return shipStatus(ctx, body);
    case 'delivery/quote':   return deliveryQuote(ctx, body);
    case 'delivery/book':    return deliveryBook(ctx, body);
    case 'delivery/status':  return deliveryStatus(ctx, body);
    case 'statement':        return statement(ctx, body);
    default:                 return json(404, { error: 'Route not found' });
  }
}

const reference = body => {
  const ref = String(body.reference ?? '').trim();
  return REFERENCE.test(ref) ? ref : null;
};

const firstProblem = (...values) => values.find(v => typeof v === 'string');

const isDuplicate = err => err?.code === 11000;

// The ledger entry for a label or courier the partner owes for; its id makes it one per purchase
async function charge(ctx, db, entry) {
  const _id = `${ctx.partner}:${entry.kind}:${entry.reference}:${entry.attempt ?? 1}`;
  await db.collection('partner_ledger').updateOne(
    { _id },
    { $setOnInsert: { _id, partner: ctx.partner, ...entry, createdAt: ctx.now().toISOString() } },
    { upsert: true },
  );
}

// ── Parcels (Easyship) ──────────────────────────────────────────────────────

function partnerRate(ctx, r) {
  return {
    id:        r.courier_service.id,
    courier:   r.courier_service.name,
    logo:      r.courier_service.logo ?? null,
    minDays:   r.min_delivery_time ?? null,
    maxDays:   r.max_delivery_time ?? null,
    price:     ctx.withMarkup(r.total_charge, markup(ctx.env, ctx.partner, 'ship')),
    currency:  'USD',
    incoterms: r.incoterms ?? 'DDU',
  };
}

async function shipRates(ctx, body) {
  const { json } = ctx;
  // Rates are priced by postal code; a checkout may not know the city yet and Easyship only needs it filled in
  const origin = ctx.cleanShipAddress({ ...body.from, city: body.from?.city || '-' }, { full: false, origin: true });
  const destination = ctx.cleanShipAddress({ ...body.to, city: body.to?.city || '-' }, { full: false, origin: false });
  const parcel = ctx.cleanParcel(body.parcel);
  const problem = firstProblem(origin, destination, parcel);
  if (problem) return json(400, { error: problem });
  try {
    const rates = (await ctx.easyshipRates(origin, destination, parcel)).map(r => partnerRate(ctx, r)).sort((a, b) => a.price - b.price);
    return json(200, { rates });
  } catch (err) {
    if (err.status === 422) return json(200, { rates: [], error: 'No courier ships this parcel between these addresses.' });
    return json(502, { rates: [], error: err.message });
  }
}

function labelReceipt(s) {
  return {
    reference:   s.reference,
    status:      s.status,            // processing | confirmed | needs_review | label_failed
    courier:     s.rate?.courier ?? null,
    courierServiceId: s.rate?.id ?? null,
    minDays:     s.rate?.minDays ?? null,
    maxDays:     s.rate?.maxDays ?? null,
    price:       s.price ?? null,
    currency:    'USD',
    easyshipId:  s.easyshipId ?? null,
    tracking:    s.tracking ?? [],
    trackingUrl: s.trackingUrl ?? null,
    documents:   s.documents ?? [],
    deliveryState: s.deliveryState ?? null,
    error:       s.labelError ?? null,
    confirmedAt: s.confirmedAt ?? null,
  };
}

async function shipLabel(ctx, body) {
  const { json } = ctx;
  const ref = reference(body);
  if (!ref) return json(400, { error: 'reference must be 1-80 letters, digits or _.:-' });
  const origin = ctx.cleanShipAddress(body.from, { full: true, origin: true });
  const destination = ctx.cleanShipAddress(body.to, { full: true, origin: false });
  const parcel = ctx.cleanParcel(body.parcel);
  const problem = firstProblem(origin, destination, parcel);
  if (problem) return json(400, { error: problem });
  const courierId = String(body.courierServiceId ?? '');
  const maxPrice = Number(body.maxPrice);
  if (!courierId) return json(400, { error: 'Choose a courier (courierServiceId)' });
  if (!(maxPrice > 0)) return json(400, { error: 'maxPrice is required' });

  const db = await ctx.getDb();
  const coll = db.collection('partner_shipments');
  const _id = `${ctx.partner}:${ref}`;
  const stamp = () => ctx.now().toISOString();
  const fresh = { _id, partner: ctx.partner, reference: ref, status: 'processing', from: origin, to: destination, parcel, createdAt: stamp(), updatedAt: stamp() };

  // Claim the reference: a new one is inserted, a failed one may be tried again, anything else is answered as is
  let attempt = 1;
  try {
    await coll.insertOne({ ...fresh, attempt });
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    const existing = await coll.findOne({ _id });
    if (existing?.status !== 'label_failed') {
      const stale = existing?.status === 'processing' && ctx.now() - new Date(existing.updatedAt) > ctx.STALE_PROCESSING_MS;
      if (!stale) return json(existing?.status === 'processing' ? 202 : 200, labelReceipt(existing));
      // The call buying this label died mid-purchase; whether Easyship charged is unknown, so a person checks it
      await coll.updateOne({ _id, status: 'processing' }, { $set: { status: 'needs_review', labelError: 'label purchase timed out', updatedAt: stamp() } });
      await alert(ctx, existing, 'label purchase timed out');
      return json(200, labelReceipt({ ...existing, status: 'needs_review', labelError: 'label purchase timed out' }));
    }
    attempt = (existing.attempt ?? 1) + 1;
    const retaken = await coll.updateOne({ _id, status: 'label_failed' }, { $set: { ...fresh, attempt, labelError: null } });
    if (!retaken.modifiedCount) return json(202, labelReceipt({ ...existing, status: 'processing' }));
  }

  const fail = async (reason, status = 422) => {
    await coll.updateOne({ _id }, { $set: { status: 'label_failed', labelError: String(reason), updatedAt: stamp() } });
    return json(status, { ...labelReceipt({ ...fresh, status: 'label_failed', labelError: String(reason) }), error: String(reason) });
  };

  // Price again now; the partner said the most it will pay
  let rate;
  try {
    rate = (await ctx.easyshipRates(origin, destination, parcel)).find(r => r.courier_service.id === courierId);
  } catch (err) {
    return fail(`Could not price this shipment: ${err.message}`, 502);
  }
  if (!rate) return fail('That courier no longer ships this parcel. Get rates again.', 409);
  const pub = partnerRate(ctx, rate);
  if (pub.price > maxPrice + 0.01) return fail(`This label now costs USD ${pub.price.toFixed(2)}, more than the USD ${maxPrice.toFixed(2)} allowed.`, 409);
  const rateInfo = { id: pub.id, courier: pub.courier, minDays: pub.minDays, maxDays: pub.maxDays, incoterms: pub.incoterms };
  await coll.updateOne({ _id }, { $set: { rate: rateInfo, baseCost: rate.total_charge, price: pub.price } });

  let shipment;
  try {
    const data = await ctx.easyshipFetch('/shipments', {
      method: 'POST',
      timeoutMs: 90_000,
      body: {
        origin_address: origin,
        destination_address: destination,
        parcels: [parcel],
        incoterms: 'DDU',
        insurance: { is_insured: false },
        courier_settings: { courier_service_id: courierId, allow_fallback: false },
        shipping_settings: {
          units: { weight: 'kg', dimensions: 'cm' },
          buy_label: true,
          buy_label_synchronous: true,
          printing_options: { format: 'url', label: '4x6', commercial_invoice: 'A4' },
        },
        order_data: { platform_order_number: `${ctx.partner}-${ref}${attempt > 1 ? `-${attempt}` : ''}` },
      },
    });
    shipment = data.shipment;
  } catch (err) {
    if (err.status === 402) await alert(ctx, { ...fresh, rate: rateInfo }, `Easyship balance is too low: ${err.message}`);
    if (err.status >= 400 && err.status < 500) return fail(err.message);
    // A timeout or server error may still have bought the label
    await coll.updateOne({ _id }, { $set: { status: 'needs_review', labelError: err.message, updatedAt: stamp() } });
    await alert(ctx, { ...fresh, rate: rateInfo }, err.message);
    return json(200, labelReceipt({ ...fresh, rate: rateInfo, price: pub.price, status: 'needs_review', labelError: err.message }));
  }

  const result = ctx.shipmentResult(shipment);
  if (result.labelState !== 'generated' && result.labelState !== 'printed') {
    await coll.updateOne({ _id }, { $set: { easyshipId: result.easyshipId } });
    await ctx.easyshipFetch(`/shipments/${result.easyshipId}/cancel`, { method: 'POST' }).catch(() => {});
    return fail(`The courier didn't issue a label (${result.labelState}).`);
  }
  const confirmed = { status: 'confirmed', ...result, confirmedAt: stamp(), updatedAt: stamp() };
  await coll.updateOne({ _id }, { $set: confirmed });
  await charge(ctx, db, { kind: 'label', reference: ref, attempt, amount: pub.price, cost: rate.total_charge, currency: 'USD',
    description: `${pub.courier} label to ${destination.city}, ${destination.country_alpha2}`, easyshipId: result.easyshipId });
  return json(201, labelReceipt({ ...fresh, rate: rateInfo, price: pub.price, ...confirmed }));
}

async function shipStatus(ctx, body) {
  const { json } = ctx;
  const ref = reference(body);
  if (!ref) return json(400, { error: 'reference is required' });
  const coll = (await ctx.getDb()).collection('partner_shipments');
  const s = await coll.findOne({ _id: `${ctx.partner}:${ref}` });
  if (!s) return json(404, { error: 'No label for this reference' });
  if (s.status !== 'confirmed' || !s.easyshipId) return json(200, labelReceipt(s));
  try {
    // Label links can be short-lived, and tracking moves on, so ask Easyship each time
    const shipment = (await ctx.easyshipFetch(`/shipments/${s.easyshipId}`, { timeoutMs: 10_000 })).shipment;
    const set = { ...ctx.shipmentResult(shipment), deliveryState: shipment.delivery_state ?? null, updatedAt: ctx.now().toISOString() };
    await coll.updateOne({ _id: s._id }, { $set: set });
    return json(200, labelReceipt({ ...s, ...set }));
  } catch {
    return json(200, labelReceipt(s));
  }
}

async function alert(ctx, s, reason) {
  await ctx.sendEmail({
    to: ctx.bookingsAlertEmail(),
    subject: `Partner label needs review: ${ctx.partner} ${s.reference}`,
    html: `<p>A ${ctx.partner} shipping label needs a person.</p><p>Reference: ${s.reference}<br>Courier: ${s.rate?.courier ?? '—'}<br>Reason: ${String(reason).replace(/[<>&]/g, '')}</p>`
      + `<p>Check Easyship for a shipment with order number ${ctx.partner}-${s.reference}. If a label exists, set the partner_shipments row to confirmed with its tracking; otherwise set it to label_failed.</p>`,
    text: `Partner label ${ctx.partner} ${s.reference} needs review: ${reason}`,
  }).catch(() => {});
}

// ── Same-day couriers ───────────────────────────────────────────────────────

const deliveryProblem = (ctx, body) => {
  const pickup = ctx.cleanDeliveryStop(body.pickup, 'pickup');
  const dropoff = ctx.cleanDeliveryStop(body.dropoff, 'drop-off');
  const item = ctx.cleanDeliveryItem(body.item);
  return { pickup, dropoff, item, problem: firstProblem(pickup, dropoff, item) };
};

async function deliveryQuote(ctx, body) {
  const { json } = ctx;
  const { pickup, dropoff, item, problem } = deliveryProblem(ctx, body);
  if (problem) return json(400, { error: problem });
  try {
    const q = await ctx.courierQuote(pickup, dropoff, item);
    return json(200, {
      price: ctx.withMarkup(q.fee / 100, markup(ctx.env, ctx.partner, 'delivery')), currency: q.currency,
      pickupMinutes: q.pickupMinutes, totalMinutes: q.totalMinutes, dropoffEta: q.dropoffEta,
    });
  } catch (err) {
    return json(err.status >= 500 ? 502 : 200, { error: ctx.uberDeliveryError(err) });
  }
}

function deliveryReceipt(d) {
  return {
    reference:   d.reference,
    status:      d.status,            // processing | active | delivered | canceled | returned | booking_failed
    step:        d.uberStatus ?? null,
    price:       d.price ?? null,
    currency:    d.currency ?? null,
    trackingUrl: d.trackingUrl ?? null,
    dropoffEta:  d.dropoffEta ?? null,
    courier:     d.courier ?? null,
    error:       d.bookingError ?? null,
    confirmedAt: d.confirmedAt ?? null,
  };
}

async function deliveryBook(ctx, body) {
  const { json } = ctx;
  const ref = reference(body);
  if (!ref) return json(400, { error: 'reference must be 1-80 letters, digits or _.:-' });
  const { pickup, dropoff, item, problem } = deliveryProblem(ctx, body);
  if (problem) return json(400, { error: problem });
  const maxPrice = Number(body.maxPrice);
  if (!(maxPrice > 0)) return json(400, { error: 'maxPrice is required' });

  const db = await ctx.getDb();
  const coll = db.collection('partner_deliveries');
  const _id = `${ctx.partner}:${ref}`;
  const stamp = () => ctx.now().toISOString();
  const fresh = { _id, partner: ctx.partner, reference: ref, status: 'processing', pickup, dropoff, item, leaveAtDoor: !!body.leaveAtDoor, createdAt: stamp(), updatedAt: stamp() };

  let order = { ...fresh, attempt: 1 };
  try {
    await coll.insertOne(order);
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    const existing = await coll.findOne({ _id });
    if (existing?.status === 'booking_failed') {
      order = { ...fresh, attempt: (existing.attempt ?? 1) + 1 };
      const retaken = await coll.updateOne({ _id, status: 'booking_failed' }, { $set: { ...order, bookingError: null, bookingProvider: null, bookedQuote: null } });
      if (!retaken.modifiedCount) return json(202, deliveryReceipt({ ...existing, status: 'processing' }));
    } else if (existing?.status === 'processing' && ctx.now() - new Date(existing.updatedAt) > ctx.STALE_PROCESSING_MS) {
      // The call that was booking died; creating again with the same id returns the same delivery
      const retaken = await coll.updateOne({ _id, status: 'processing', updatedAt: existing.updatedAt }, { $set: { updatedAt: stamp() } });
      if (!retaken.modifiedCount) return json(202, deliveryReceipt(existing));
      order = existing;
    } else {
      return json(existing?.status === 'processing' ? 202 : 200, deliveryReceipt(existing));
    }
  }

  const fail = async (reason, status = 422) => {
    await coll.updateOne({ _id }, { $set: { status: 'booking_failed', bookingError: String(reason), updatedAt: stamp() } });
    return json(status, { ...deliveryReceipt({ ...order, status: 'booking_failed', bookingError: String(reason) }), error: String(reason) });
  };

  // The provider and quote are fixed before anything is created, so a retry never books a second courier elsewhere
  let quote = order.bookedQuote;
  if (!quote) {
    try {
      quote = await ctx.courierQuote(pickup, dropoff, item);
    } catch (err) {
      if (err.status >= 500 || !err.status) {
        await coll.updateOne({ _id }, { $set: { updatedAt: new Date(0).toISOString() } });
        return json(503, { ...deliveryReceipt(order), pending: true, error: 'The courier service is busy. Try again.' });
      }
      return fail(ctx.uberDeliveryError(err));
    }
    const price = ctx.withMarkup(quote.fee / 100, markup(ctx.env, ctx.partner, 'delivery'));
    if (price > maxPrice + 0.01) return fail(`A courier now costs ${quote.currency} ${price.toFixed(2)}, more than the ${maxPrice.toFixed(2)} allowed.`, 409);
    order = { ...order, bookingProvider: quote.provider, bookedQuote: quote, baseFeeCents: quote.fee, price, currency: quote.currency };
    await coll.updateOne({ _id }, { $set: { bookingProvider: quote.provider, bookedQuote: quote, baseFeeCents: quote.fee, price, currency: quote.currency } });
  }

  const providerId = `${ctx.partner}-${ref}${order.attempt > 1 ? `-${order.attempt}` : ''}`;
  let delivery;
  try {
    delivery = order.bookingProvider === 'doordash'
      ? await ctx.doordashDeliveryCreate(providerId, order)
      : await ctx.uberDeliveryCreate(providerId, order, quote);
  } catch (err) {
    if (err.status >= 400 && err.status < 500) return fail(`${ctx.uberDeliveryError(err)}`);
    // Timeout or provider error: the next call retries safely (both providers dedupe on the id)
    await coll.updateOne({ _id }, { $set: { updatedAt: new Date(0).toISOString() } });
    return json(503, { ...deliveryReceipt(order), pending: true, error: 'Booking the courier; try again in a moment.' });
  }
  const set = { ...ctx.deliveryResult(order.bookingProvider, delivery), confirmedAt: stamp(), updatedAt: stamp() };
  await coll.updateOne({ _id }, { $set: set });
  await charge(ctx, db, { kind: 'courier', reference: ref, attempt: order.attempt, amount: order.price, cost: order.baseFeeCents / 100,
    currency: order.currency, description: `Courier ${pickup.label.split(',')[0]} → ${dropoff.label.split(',')[0]}` });
  return json(201, deliveryReceipt({ ...order, ...set }));
}

async function deliveryStatus(ctx, body) {
  const { json } = ctx;
  const ref = reference(body);
  if (!ref) return json(400, { error: 'reference is required' });
  const coll = (await ctx.getDb()).collection('partner_deliveries');
  const d = await coll.findOne({ _id: `${ctx.partner}:${ref}` });
  if (!d) return json(404, { error: 'No courier for this reference' });
  const deliveryId = d.courierDeliveryId;
  if (!deliveryId || d.status !== 'active') return json(200, deliveryReceipt(d));
  try {
    const set = { ...ctx.deliveryResult(d.courierProvider, await ctx.fetchCourierDelivery(d.courierProvider, deliveryId, 8000)), updatedAt: ctx.now().toISOString() };
    await coll.updateOne({ _id: d._id }, { $set: set });
    return json(200, deliveryReceipt({ ...d, ...set }));
  } catch {
    return json(200, deliveryReceipt(d));
  }
}

// ── What the partner owes ───────────────────────────────────────────────────

async function statement(ctx, body) {
  const { json } = ctx;
  const month = /^\d{4}-\d{2}$/.test(String(body.month ?? '')) ? body.month : null;
  const filter = { partner: ctx.partner, ...(month && { createdAt: { $gte: `${month}-01`, $lt: nextMonth(month) } }) };
  const entries = await (await ctx.getDb()).collection('partner_ledger').find(filter).sort({ createdAt: -1 }).limit(LEDGER_LIMIT).toArray();
  const totals = {};
  for (const e of entries) {
    const t = totals[e.currency] ??= { amount: 0, cost: 0, count: 0 };
    t.amount = Math.round((t.amount + e.amount) * 100) / 100;
    t.cost = Math.round((t.cost + (e.cost ?? 0)) * 100) / 100;
    t.count += 1;
  }
  return json(200, {
    partner: ctx.partner, month, totals, truncated: entries.length === LEDGER_LIMIT,
    entries: entries.map(e => ({ kind: e.kind, reference: e.reference, amount: e.amount, currency: e.currency, description: e.description, createdAt: e.createdAt })),
  });
}

function nextMonth(month) {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
