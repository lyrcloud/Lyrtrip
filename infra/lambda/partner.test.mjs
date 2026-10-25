// node --test infra/lambda/partner.test.mjs — the partner shipping API against fake Easyship, couriers and MongoDB
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePartner, partnerFor } from './partner.mjs';

const KEY = 'lyr_partner_test_key_0123456789abcdef';
const env = { LYRSHOP_PARTNER_KEY: KEY, LYRSHOP_SHIP_MARKUP: '1.05' };
const json = (statusCode, body) => ({ statusCode, body });

function fakeDb() {
  const colls = {};
  const coll = name => (colls[name] ??= (() => {
    const rows = new Map();
    const matches = (row, filter) => Object.entries(filter).every(([k, v]) => {
      if (v && typeof v === 'object' && ('$gte' in v)) return row[k] >= v.$gte && row[k] < v.$lt;
      return row[k] === v;
    });
    return {
      rows,
      async insertOne(doc) { if (rows.has(doc._id)) throw Object.assign(new Error('dup'), { code: 11000 }); rows.set(doc._id, structuredClone(doc)); },
      async findOne(f) { return [...rows.values()].find(r => matches(r, f)) ?? null; },
      async updateOne(f, u, opts = {}) {
        const row = [...rows.values()].find(r => matches(r, f));
        if (!row) {
          if (opts.upsert) { rows.set(f._id, { ...u.$setOnInsert }); return { modifiedCount: 0, upsertedCount: 1 }; }
          return { modifiedCount: 0 };
        }
        Object.assign(row, u.$set ?? {});
        return { modifiedCount: u.$set ? 1 : 0 };
      },
      find(f) {
        const list = [...rows.values()].filter(r => matches(r, f));
        const cursor = { sort: () => cursor, limit: () => cursor, toArray: async () => list };
        return cursor;
      },
    };
  })());
  return { collection: coll, colls };
}

function deps(over = {}) {
  const db = fakeDb();
  const calls = { shipments: 0, deliveries: 0, emails: 0 };
  const rate = { courier_service: { id: 'svc-usps', name: 'USPS - Ground Advantage' }, total_charge: 10, min_delivery_time: 2, max_delivery_time: 5 };
  return {
    db, calls,
    d: {
      json, getDb: async () => db, withMarkup: (a, m) => Math.ceil(Number((a * m * 100).toFixed(6))) / 100,
      sendEmail: async () => { calls.emails += 1; }, bookingsAlertEmail: () => 'ops@example.com', STALE_PROCESSING_MS: 150_000,
      cleanShipAddress: (a, { full }) => (!a?.country ? 'Choose a country' : !a.city ? 'Enter the city' : full && !a.name ? 'Enter the name'
        : { country_alpha2: a.country, city: a.city, postal_code: a.postalCode ?? '', ...(full && { contact_name: a.name }) }),
      cleanParcel: p => (p?.weightKg > 0 ? { total_actual_weight: p.weightKg, box: { length: 20, width: 15, height: 10 }, items: [] } : 'Weight must be 0.01 to 70 kg'),
      easyshipRates: async () => [rate],
      easyshipFetch: async (path) => {
        if (path === '/shipments') { calls.shipments += 1; return { shipment: { easyship_shipment_id: 'ESUS1', label_state: 'generated' } }; }
        return { shipment: { easyship_shipment_id: 'ESUS1', label_state: 'generated', delivery_state: 'in_transit_to_customer' } };
      },
      shipmentResult: s => ({ easyshipId: s.easyship_shipment_id, labelState: s.label_state, tracking: [{ number: '9400TEST' }], trackingUrl: 'https://track/x', documents: [{ category: 'label', url: 'https://label/x' }] }),
      cleanDeliveryStop: (p, side) => (p?.line1 ? { ...p, label: `${p.line1}, ${p.city}`, address: '{}' } : `Enter the ${side} street address`),
      cleanDeliveryItem: i => (i?.description ? { description: i.description, size: 'small', valueCents: 0 } : 'Describe what the courier is carrying'),
      courierQuote: async () => ({ provider: 'uber', quoteId: 'dq1', fee: 1250, currency: 'USD', pickupMinutes: 10, totalMinutes: 40, dropoffEta: null }),
      uberDeliveryError: e => e.message,
      uberDeliveryCreate: async () => { calls.deliveries += 1; return { id: 'del_1', status: 'pending', tracking_url: 'https://uber/t' }; },
      doordashDeliveryCreate: async () => { throw new Error('not used'); },
      deliveryResult: (provider, d) => ({ courierProvider: provider, courierDeliveryId: d.id, uberStatus: d.status, status: d.status === 'delivered' ? 'delivered' : 'active', trackingUrl: d.tracking_url }),
      fetchCourierDelivery: async () => ({ id: 'del_1', status: 'delivered', tracking_url: 'https://uber/t' }),
      ...over,
    },
  };
}

const call = (d, route, body, key = KEY) => handlePartner(
  { rawPath: `/api/partner/${route}`, headers: { Authorization: `Bearer ${key}` }, body: JSON.stringify(body) }, d, env);

const from = { country: 'US', city: 'New York', postalCode: '10001', name: 'Lyrshop' };
const to = { country: 'US', city: 'Austin', postalCode: '78701', name: 'Ann Buyer' };
const parcel = { weightKg: 0.5 };

test('rejects unknown and short keys', async () => {
  const { d } = deps();
  assert.equal((await call(d, 'ship/rates', {}, 'wrong-key-wrong-key-wrong-key')).statusCode, 401);
  assert.equal(partnerFor({ headers: { authorization: 'Bearer short' } }, { LYRSHOP_PARTNER_KEY: 'short' }), null);
  assert.equal(partnerFor({ headers: { authorization: `Bearer ${KEY}` } }, env), 'lyrshop');
});

test('rates carry the partner markup and fill a missing city', async () => {
  const { d } = deps();
  const r = await call(d, 'ship/rates', { from, to: { country: 'US', postalCode: '78701' }, parcel });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body.rates.map(x => [x.id, x.price]), [['svc-usps', 10.5]]);
});

test('a label is bought once per reference and charged to the ledger', async () => {
  const { d, db, calls } = deps();
  const body = { reference: 'ord-1', from, to, parcel, courierServiceId: 'svc-usps', maxPrice: 11 };
  const first = await call(d, 'ship/label', body);
  assert.equal(first.statusCode, 201);
  assert.equal(first.body.status, 'confirmed');
  assert.equal(first.body.tracking[0].number, '9400TEST');
  const again = await call(d, 'ship/label', body);
  assert.equal(again.statusCode, 200);
  assert.equal(calls.shipments, 1);
  const ledger = [...db.colls.partner_ledger.rows.values()];
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].amount, 10.5);
  const st = await call(d, 'statement', {});
  assert.deepEqual(st.body.totals.USD, { amount: 10.5, cost: 10, count: 1 });
  const status = await call(d, 'ship/status', { reference: 'ord-1' });
  assert.equal(status.body.deliveryState, 'in_transit_to_customer');
});

test('a label over the allowed price fails and may be retried', async () => {
  const { d, calls } = deps();
  const body = { reference: 'ord-2', from, to, parcel, courierServiceId: 'svc-usps', maxPrice: 9 };
  const r = await call(d, 'ship/label', body);
  assert.equal(r.statusCode, 409);
  assert.equal(r.body.status, 'label_failed');
  const retry = await call(d, 'ship/label', { ...body, maxPrice: 12 });
  assert.equal(retry.statusCode, 201);
  assert.equal(calls.shipments, 1);
});

test('an Easyship timeout goes to review instead of failing', async () => {
  const { d, calls } = deps({ easyshipFetch: async () => { throw Object.assign(new Error('timeout'), { status: undefined }); } });
  const r = await call(d, 'ship/label', { reference: 'ord-3', from, to, parcel, courierServiceId: 'svc-usps', maxPrice: 20 });
  assert.equal(r.body.status, 'needs_review');
  assert.equal(calls.emails, 1);
  const again = await call(d, 'ship/label', { reference: 'ord-3', from, to, parcel, courierServiceId: 'svc-usps', maxPrice: 20 });
  assert.equal(again.body.status, 'needs_review');
});

test('a courier is booked once, within the allowed price, and tracked', async () => {
  const { d, db, calls } = deps();
  const stop = { line1: '1 Main St', city: 'Austin', name: 'A', phone: '+15125550100' };
  const body = { reference: 'ord-4', pickup: stop, dropoff: stop, item: { description: 'Shoes' }, maxPrice: 13 };
  assert.equal((await call(d, 'delivery/quote', body)).body.price, 12.5);
  const tooCheap = await call(d, 'delivery/book', { ...body, reference: 'ord-5', maxPrice: 10 });
  assert.equal(tooCheap.statusCode, 409);
  const r = await call(d, 'delivery/book', body);
  assert.equal(r.statusCode, 201);
  assert.equal(r.body.status, 'active');
  assert.equal((await call(d, 'delivery/book', body)).statusCode, 200);
  assert.equal(calls.deliveries, 1);
  assert.equal((await call(d, 'delivery/status', { reference: 'ord-4' })).body.status, 'delivered');
  assert.equal([...db.colls.partner_ledger.rows.values()].filter(e => e.kind === 'courier').length, 1);
});

test('bad references and routes', async () => {
  const { d } = deps();
  assert.equal((await call(d, 'ship/label', { reference: 'has space' })).statusCode, 400);
  assert.equal((await call(d, 'nope', {})).statusCode, 404);
});
