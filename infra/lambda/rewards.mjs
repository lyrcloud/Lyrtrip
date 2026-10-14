// Rewards, as on Lyrshop: points, tiers and badges, gift cards, coupons, affiliate links and business (B2B) accounts.
//
// Collections: `accounts` (one per Cognito sub: points, stats, referral code, business application), `promos`
// (keyed "coupon#CODE", "giftcard#CODE", "referral#CODE") and `settings` (the super admin's program settings).
// Money is in integer cents. A point is worth one cent (100 points = $1).
//
// Bookings hold what checkout took (coupon use, gift card balance, points) in a `credits` field. Holds are given back
// if the payment never completes or the booking is refunded; points are earned only once a booking is confirmed.
import { randomInt } from 'node:crypto';

export const POINTS_PER_DOLLAR = 100;
// Stripe needs something to charge, so credits always leave at least this much for the card.
export const MIN_CARD_CENTS = 100;
export const HISTORY_LIMIT = 50;

export const GIFT_CARD_MIN = 5;
export const GIFT_CARD_MAX = 500;
export const GIFT_CARD_PRESETS = [25, 50, 100, 200];
// No 0/O or 1/I/L, so codes read back correctly over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const COUPON_CODE = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const TIERS = [['Platinum', 5000], ['Gold', 2000], ['Silver', 500], ['Bronze', 100], ['Member', 0]];

// [id, label, description, test on the account's stats]
export const BADGES = [
  ['first-trip', 'First trip', 'Completed a first booking', s => s.bookings_paid >= 1],
  ['frequent-traveller', 'Frequent traveller', '10 or more bookings', s => s.bookings_paid >= 10],
  ['big-spender', 'Big spender', '$5,000 or more booked', s => s.spent_cents >= 500000],
  ['affiliate', 'Affiliate', 'Referred a booking', s => s.referral_orders >= 1],
  ['super-affiliate', 'Super affiliate', 'Referred 10 or more bookings', s => s.referral_orders >= 10],
  ['gift-giver', 'Gift giver', 'Sent a gift card', s => s.gift_cards_sent >= 1],
];

const STAT_FIELDS = ['points_balance', 'points_lifetime', 'bookings_paid', 'spent_cents', 'referral_orders', 'referral_points', 'gift_cards_sent'];

// What the super admin can change. Retail bookings keep the 12% service fee.
export const DEFAULT_SETTINGS = { pointsPerDollarSpent: 1, affiliatePercent: 5, businessFeePercent: 6 };

export class RewardsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const cents = d => Math.round(Number(d || 0) * 100);
export const dollars = c => Math.round(c) / 100;
const text = (v, limit) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
const nowIso = () => new Date().toISOString();
const doc = r => (r?.value !== undefined ? r.value : r);  // findOneAndUpdate's result shape differs across driver versions

export function newCode(groups = 3, size = 4, prefix = 'LYR') {
  const parts = Array.from({ length: groups }, () => Array.from({ length: size }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''));
  return prefix ? [prefix, ...parts].join('-') : parts.join('');
}

export const normalizeCode = v => String(v ?? '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
export const masked = code => (code ? `${code.slice(0, 4)}…${code.slice(-4)}` : '');
export const couponId = code => `coupon#${code}`;
export const giftCardId = code => `giftcard#${code}`;
const referralId = code => `referral#${code}`;

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(db) {
  const saved = await db.collection('settings').findOne({ _id: 'rewards' });
  return { ...DEFAULT_SETTINGS, ...(saved ? Object.fromEntries(Object.keys(DEFAULT_SETTINGS).filter(k => k in saved).map(k => [k, saved[k]])) : {}) };
}

export function cleanSettings(body) {
  const n = (key, min, max, label) => {
    const v = Number(body?.[key]);
    if (!Number.isFinite(v) || v < min || v > max) throw new RewardsError(`${label} must be ${min} to ${max}.`);
    return Math.round(v * 100) / 100;
  };
  return {
    pointsPerDollarSpent: n('pointsPerDollarSpent', 0, 10, 'Points per dollar'),
    affiliatePercent:     n('affiliatePercent', 0, 10, 'Affiliate commission'),
    businessFeePercent:   n('businessFeePercent', 0, 12, 'Business service fee'),
  };
}

// ── Tiers, badges and stats ──────────────────────────────────────────────────

export const stats = account => Object.fromEntries(STAT_FIELDS.map(f => [f, Math.trunc(Number(account?.[f]) || 0)]));

export function tier(lifetime) {
  return (TIERS.find(([, min]) => lifetime >= min) ?? TIERS[TIERS.length - 1])[0];
}

export function nextTier(lifetime) {
  const above = TIERS.filter(([, min]) => min > lifetime);
  return above.length ? { name: above[above.length - 1][0], pointsNeeded: above[above.length - 1][1] - lifetime } : null;
}

export function badges(account) {
  const s = stats(account);
  return BADGES.filter(([, , , test]) => test(s)).map(([id, label, description]) => ({ id, label, description }));
}

// ── Accounts ─────────────────────────────────────────────────────────────────

// The signed-in user's rewards account, created on first use.
export async function getAccount(db, user) {
  const r = await db.collection('accounts').findOneAndUpdate(
    { _id: user.sub },
    { $set: { email: user.email, name: user.name ?? '' }, $setOnInsert: { createdAt: nowIso() } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc(r);
}

const historyPush = (points, note) => ({ points_history: { $each: [{ at: nowIso(), points, note }], $slice: -HISTORY_LIMIT } });

// Adds (or with a negative number, removes) points and stats. Lifetime points set the tier.
export async function creditAccount(db, sub, points, deltas = {}, note = '', { lifetime = true } = {}) {
  const $inc = { points_balance: points, ...deltas };
  if (lifetime) $inc.points_lifetime = points;
  const r = await db.collection('accounts').updateOne({ _id: sub }, { $inc, $push: historyPush(points, note) }, { upsert: true });
  return r.matchedCount + (r.upsertedCount ?? 0) > 0;
}

// Spends points only when the balance covers them.
export async function takePoints(db, sub, points, note) {
  const r = await db.collection('accounts').updateOne(
    { _id: sub, points_balance: { $gte: points } },
    { $inc: { points_balance: -points }, $push: historyPush(-points, note) },
  );
  return r.modifiedCount === 1;
}

// ── Coupons ──────────────────────────────────────────────────────────────────

export function cleanCoupon(body) {
  const code = normalizeCode(body?.code);
  if (!COUPON_CODE.test(code)) throw new RewardsError('Codes are 3-24 letters, numbers, dashes or underscores.');
  const type = body?.type;
  if (!['percent', 'fixed'].includes(type)) throw new RewardsError('Choose percent off or amount off.');
  const value = Number(body?.value), minTotal = Number(body?.min_total || 0), maxUses = Number(body?.max_uses || 0);
  if (![value, minTotal, maxUses].every(Number.isFinite)) throw new RewardsError('Enter numbers for the discount, minimum spend and usage limit.');
  if (type === 'percent' && !(value >= 1 && value <= 90)) throw new RewardsError('Percent off must be 1 to 90.');
  if (type === 'fixed' && !(value >= 0.5 && value <= 1000)) throw new RewardsError('Amount off must be $0.50 to $1,000.');
  if (minTotal < 0 || maxUses < 0) throw new RewardsError("The minimum spend and usage limit can't be negative.");
  const expires = String(body?.expires ?? '').trim();
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) throw new RewardsError('Choose a valid expiry date.');
  const appliesTo = ['all', 'flight', 'hotel', 'shipping', 'delivery'].includes(body?.applies_to) ? body.applies_to : 'all';
  return {
    code, type, value: Math.round(value * 100) / 100, min_total: Math.round(minTotal * 100) / 100,
    max_uses: Math.trunc(maxUses), once_per_customer: !!body?.once_per_customer, expires, applies_to: appliesTo,
    active: body?.active !== false, description: text(body?.description, 120),
  };
}

export function couponProblem(coupon, totalCents, sub, kind, today) {
  if (!coupon || !coupon.active) return "That coupon code isn't valid.";
  if (coupon.applies_to && coupon.applies_to !== 'all' && coupon.applies_to !== kind) return `That coupon is for ${{ flight: 'flights', hotel: 'hotels', shipping: 'shipping', delivery: 'courier deliveries' }[coupon.applies_to]} only.`;
  if (coupon.expires && coupon.expires < today) return 'That coupon has expired.';
  if (coupon.max_uses && (coupon.uses ?? 0) >= coupon.max_uses) return 'That coupon has been fully used.';
  if (coupon.once_per_customer && !sub) return 'Sign in to use that coupon.';
  if (coupon.once_per_customer && (coupon.used_by ?? []).includes(sub)) return "You've already used that coupon.";
  if (totalCents < cents(coupon.min_total)) return `That coupon needs a booking of at least $${Number(coupon.min_total).toFixed(2)}.`;
  return null;
}

export const couponDiscount = (coupon, totalCents) =>
  Math.min(coupon.type === 'percent' ? Math.round(totalCents * coupon.value / 100) : cents(coupon.value), totalCents);

async function takeCoupon(db, code, sub, once) {
  const r = await db.collection('promos').updateOne(
    {
      _id: couponId(code), active: true,
      $expr: { $or: [{ $eq: [{ $ifNull: ['$max_uses', 0] }, 0] }, { $lt: [{ $ifNull: ['$uses', 0] }, '$max_uses'] }] },
      ...(once && { used_by: { $ne: sub } }),
    },
    { $inc: { uses: 1 }, ...(sub && { $push: { used_by: sub } }) },
  );
  return r.modifiedCount === 1;
}

async function returnCoupon(db, code, sub) {
  await db.collection('promos').updateOne({ _id: couponId(code) }, { $inc: { uses: -1 }, ...(sub && { $pull: { used_by: sub } }) });
}

// ── Gift cards ───────────────────────────────────────────────────────────────

async function takeGiftCard(db, code, amountCents) {
  const r = await db.collection('promos').updateOne(
    { _id: giftCardId(code), status: 'active', balance_cents: { $gte: amountCents } },
    { $inc: { balance_cents: -amountCents } },
  );
  return r.modifiedCount === 1;
}

async function returnGiftCard(db, code, amountCents) {
  await db.collection('promos').updateOne({ _id: giftCardId(code) }, { $inc: { balance_cents: amountCents } });
}

export function cleanGiftCard(body) {
  const amount = Number(body?.amount);
  if (!(amount >= GIFT_CARD_MIN && amount <= GIFT_CARD_MAX) || Math.round(amount * 100) / 100 !== amount) {
    throw new RewardsError(`Gift cards are $${GIFT_CARD_MIN} to $${GIFT_CARD_MAX}.`);
  }
  const recipientEmail = String(body?.recipient_email ?? '').trim().toLowerCase();
  if (recipientEmail && !EMAIL.test(recipientEmail)) throw new RewardsError('Enter a valid recipient email, or leave it empty to keep the card yourself.');
  return {
    amount, recipient_email: recipientEmail, recipient_name: text(body?.recipient_name, 60),
    sender_name: text(body?.sender_name, 60), message: String(body?.message ?? '').trim().slice(0, 300),
  };
}

export function publicGiftCard(card, includeCode = false) {
  const shown = Object.fromEntries(['amount', 'recipient_email', 'recipient_name', 'sender_name', 'message', 'status', 'createdAt', 'sentAt', 'activatedAt', 'source']
    .map(k => [k, card[k] ?? null]));
  shown.balance = dollars(card.balance_cents ?? 0);
  shown.code = includeCode && card.status === 'active' ? card.code : masked(card.code);
  return shown;
}

export function giftCardEmail(card, siteUrl) {
  const sender = card.sender_name || 'Someone';
  const note = card.message ? `\n\nTheir message:\n${card.message}` : '';
  return {
    subject: `${sender} sent you a $${Number(card.amount).toFixed(2)} Lyrtrip gift card`,
    text: `${card.recipient_name ? `Hi ${card.recipient_name},` : 'Hi,'}\n\n${sender} sent you a $${Number(card.amount).toFixed(2)} Lyrtrip gift card.${note}\n\n`
      + `Your gift card code: ${card.code}\n\nEnter it in the Gift card box when you book a flight or hotel on ${siteUrl}. `
      + "The balance carries over until it's used up.\n\n— Lyrtrip",
  };
}

// A new card with a code nobody has; `fields` comes from cleanGiftCard.
export async function createGiftCard(db, fields, extra) {
  for (;;) {
    const code = newCode();
    const card = { _id: giftCardId(code), kind: 'giftcard', code, ...fields, balance_cents: 0, createdAt: nowIso(), ...extra };
    try {
      await db.collection('promos').insertOne(card);
      return card;
    } catch (err) {
      if (err.code !== 11000) throw err;  // duplicate code: draw again
    }
  }
}

// ── Business (B2B) accounts ──────────────────────────────────────────────────

export function cleanBusinessApplication(body) {
  const f = {
    company: text(body?.company, 100), tax_id: text(body?.tax_id, 30), country: text(body?.country, 2).toUpperCase(),
    address: text(body?.address, 200), phone: text(body?.phone, 30), website: text(body?.website, 200),
    industry: text(body?.industry, 60), travellers_per_year: text(body?.travellers_per_year, 20),
  };
  if (f.company.length < 2) throw new RewardsError("Enter your company's legal name.");
  if (!/^[A-Za-z0-9 .\-/]{4,30}$/.test(f.tax_id)) throw new RewardsError('Enter your business tax ID (EIN, VAT or GST number).');
  if (!/^[A-Z]{2}$/.test(f.country)) throw new RewardsError('Choose the country your business is registered in.');
  if (f.address.length < 6) throw new RewardsError('Enter your business address.');
  if (f.website && !/^https?:\/\//i.test(f.website)) f.website = `https://${f.website}`;
  return f;
}

export const isApprovedBusiness = account => account?.business?.status === 'approved';

// The service fee rate (e.g. 1.12) this account pays: retail, or the business rate once the super admin approves it.
export function feeRate(account, settings, retailRate) {
  if (!isApprovedBusiness(account)) return retailRate;
  const percent = account.business.fee_percent ?? settings.businessFeePercent;
  return Math.min(retailRate, 1 + Number(percent) / 100);
}

export function buyerFields(account) {
  if (!isApprovedBusiness(account)) return { buyerType: 'consumer' };
  return { buyerType: 'business', company: account.business.company, taxId: account.business.tax_id };
}

// ── Affiliates ───────────────────────────────────────────────────────────────

export async function referralCode(db, account) {
  if (account.referral_code) return account.referral_code;
  for (;;) {
    const code = newCode(1, 8, '');
    try {
      await db.collection('promos').insertOne({ _id: referralId(code), kind: 'referral', code, sub: account._id, createdAt: nowIso() });
    } catch (err) {
      if (err.code === 11000) continue;
      throw err;
    }
    await db.collection('accounts').updateOne({ _id: account._id }, { $set: { referral_code: code } });
    account.referral_code = code;
    return code;
  }
}

async function resolveAffiliate(db, code, buyerSub) {
  code = normalizeCode(code);
  if (!code) return null;
  const link = await db.collection('promos').findOne({ _id: referralId(code) });
  return link?.sub && link.sub !== buyerSub ? link.sub : null;
}

// ── Pricing a booking ────────────────────────────────────────────────────────

// Splits a total between coupon, gift card, points and card. Credits never take the card below MIN_CARD_CENTS.
export function splitCredits({ totalCents, couponCents = 0, cardBalanceCents = 0, pointsBalance = 0, usePoints = false }) {
  const coupon = Math.max(0, Math.min(couponCents, totalCents - MIN_CARD_CENTS));
  let room = totalCents - coupon - MIN_CARD_CENTS;
  const giftCard = Math.max(0, Math.min(cardBalanceCents, room));
  room -= giftCard;
  const points = usePoints ? Math.max(0, Math.min(Math.trunc(pointsBalance), room)) : 0;
  return { total: totalCents, coupon, giftCard, points, amountDue: totalCents - coupon - giftCard - points };
}

// Prices the extras the guest asked for. Problems are reported per field, or thrown when `strict` (at checkout).
export async function quoteCredits(db, { account, kind, totalCents, currency, body, strict = false }) {
  const errors = {};
  const couponCode = normalizeCode(body?.couponCode);
  const cardCode = normalizeCode(body?.giftCardCode);
  const usePoints = !!body?.usePoints;
  const today = nowIso().slice(0, 10);
  if ((couponCode || cardCode || usePoints) && currency !== 'USD') {
    errors.general = 'Coupons, gift cards and points work on bookings priced in US dollars.';
  }

  let coupon = null, couponCents = 0;
  if (couponCode && !errors.general) {
    const found = await db.collection('promos').findOne({ _id: couponId(couponCode) });
    const problem = couponProblem(found, totalCents, account?._id, kind, today);
    if (problem) errors.coupon = problem;
    else { coupon = found; couponCents = couponDiscount(found, totalCents); }
  }

  let card = null;
  if (cardCode && !errors.general) {
    const found = await db.collection('promos').findOne({ _id: giftCardId(cardCode) });
    if (!found || found.status !== 'active') errors.giftCard = "That gift card code isn't valid.";
    else if (!(found.balance_cents > 0)) errors.giftCard = 'That gift card has no balance left.';
    else card = found;
  }

  if (usePoints && !account) errors.points = 'Sign in to use your points.';
  const pointsBalance = account ? Math.max(0, Math.trunc(account.points_balance ?? 0)) : 0;

  if (strict && Object.keys(errors).length) throw new RewardsError(Object.values(errors)[0], 409);
  const split = splitCredits({
    totalCents, couponCents, cardBalanceCents: card?.balance_cents ?? 0, pointsBalance, usePoints: usePoints && !errors.general,
  });
  return { split, coupon, card, errors, pointsBalance };
}

export function quoteReply(q, { settings, account }) {
  const s = q.split;
  return {
    total: dollars(s.total), coupon: dollars(s.coupon), giftCard: dollars(s.giftCard), points: s.points,
    pointsValue: dollars(s.points), amountDue: dollars(s.amountDue),
    couponInfo: q.coupon ? { code: q.coupon.code, type: q.coupon.type, value: q.coupon.value, description: q.coupon.description ?? '' } : null,
    giftCardInfo: q.card ? { code: masked(q.card.code), balance: dollars(q.card.balance_cents), remainingAfter: dollars(q.card.balance_cents - s.giftCard) } : null,
    pointsAvailable: q.pointsBalance,
    pointsEarned: account ? Math.floor((s.total - s.coupon - s.points) / 100 * settings.pointsPerDollarSpent) : 0,
    errors: q.errors,
  };
}

// Takes the coupon use, gift card balance and points. On failure, gives back what was taken and throws.
export async function holdCredits(db, q, { sub, ref, note }) {
  const s = q.split;
  const taken = { reserved: true, couponCode: null, couponCents: 0, giftCardCode: null, giftCardCents: 0, points: 0, sub: sub ?? null };
  try {
    if (q.coupon && s.coupon) {
      if (!await takeCoupon(db, q.coupon.code, sub, !!q.coupon.once_per_customer)) throw new RewardsError('That coupon was just used up.', 409);
      Object.assign(taken, { couponCode: q.coupon.code, couponCents: s.coupon });
    }
    if (s.giftCard) {
      if (!await takeGiftCard(db, q.card.code, s.giftCard)) throw new RewardsError("That gift card's balance just changed. Please apply it again.", 409);
      Object.assign(taken, { giftCardCode: q.card.code, giftCardCents: s.giftCard });
    }
    if (s.points) {
      if (!await takePoints(db, sub, s.points, `Spent on ${note}`)) throw new RewardsError('Your points balance changed. Please try again.', 409);
      taken.points = s.points;
    }
  } catch (err) {
    await giveBack(db, taken, `${note} wasn't booked`);
    throw err;
  }
  return { ...taken, ref };
}

async function giveBack(db, credits, why) {
  if (credits.couponCode) await returnCoupon(db, credits.couponCode, credits.sub);
  if (credits.giftCardCode && credits.giftCardCents) await returnGiftCard(db, credits.giftCardCode, credits.giftCardCents);
  if (credits.points && credits.sub) await creditAccount(db, credits.sub, credits.points, {}, `Points returned: ${why}`, { lifetime: false });
}

// What a booking records about its price, buyer and referral.
export async function bookingCredits(db, { q, held, account, feeRate: rate, retailTotal, affiliateCode, currency = 'USD' }) {
  return {
    ...held,
    currency,
    total: dollars(q.split.total),
    amountDue: dollars(q.split.amountDue),
    retailTotal,
    feeRate: rate,
    affiliate: await resolveAffiliate(db, affiliateCode, account?._id ?? null),
    ...buyerFields(account),
  };
}

// Gives back what a booking held, once (an unpaid, expired or refunded booking).
export async function releaseCredits(db, coll, _id, why) {
  const r = await coll.findOneAndUpdate(
    { _id, 'credits.reserved': true, 'credits.released': { $ne: true }, 'credits.earned': { $ne: true } },
    { $set: { 'credits.released': true, 'credits.releasedAt': nowIso() } },
    { returnDocument: 'after' },
  );
  const booking = doc(r);
  if (booking) await giveBack(db, booking.credits, why);
  return !!booking;
}

// Awards points to the traveller and the referring affiliate, once, when a booking is confirmed.
export async function earnRewards(db, coll, _id, label) {
  const r = await coll.findOneAndUpdate(
    { _id, credits: { $exists: true }, 'credits.earned': { $ne: true }, 'credits.released': { $ne: true } },
    { $set: { 'credits.earned': true } },
    { returnDocument: 'after' },
  );
  const booking = doc(r);
  if (!booking) return [];
  const c = booking.credits;
  if (c.currency && c.currency !== 'USD') return [];  // points are dollars, like spending them
  const settings = await getSettings(db);
  const totalCents = cents(c.total);
  const earning = Math.max(0, totalCents - c.couponCents - c.points);
  const awarded = [];
  if (c.sub) {
    const points = Math.floor(earning / 100 * settings.pointsPerDollarSpent);
    await creditAccount(db, c.sub, points, { bookings_paid: 1, spent_cents: earning }, label);
    awarded.push({ sub: c.sub, points });
  }
  if (c.affiliate && c.affiliate !== c.sub) {
    const points = Math.floor((totalCents - c.couponCents) * settings.affiliatePercent / 100);
    await creditAccount(db, c.affiliate, points, { referral_orders: 1, referral_points: points }, `Referral commission (${label})`);
    awarded.push({ sub: c.affiliate, points });
  }
  await coll.updateOne({ _id }, { $set: { 'credits.awarded': awarded } });
  return awarded;
}

// ── The rewards page ─────────────────────────────────────────────────────────

export async function myGiftCards(db, account) {
  const email = String(account.email ?? '').toLowerCase();
  const cards = await db.collection('promos').find({
    kind: 'giftcard', $or: [{ buyer: account._id }, ...(email ? [{ recipient_email: email, status: 'active' }] : [])],
  }).sort({ createdAt: -1 }).limit(100).toArray();
  return {
    bought: cards.filter(c => c.buyer === account._id).map(c => publicGiftCard(c, true)),
    received: cards.filter(c => c.buyer !== account._id).map(c => publicGiftCard(c, true)),
  };
}

export async function rewardsSummary(db, account, siteUrl) {
  const settings = await getSettings(db);
  const s = stats(account);
  const earned = new Set(badges(account).map(b => b.id));
  const code = await referralCode(db, account);
  const cards = await myGiftCards(db, account);
  return {
    points: s.points_balance,
    pointsValue: dollars(Math.max(0, s.points_balance)),
    pointsLifetime: s.points_lifetime,
    giftCardBalance: dollars(cards.received.concat(cards.bought.filter(c => !c.recipient_email))
      .filter(c => c.status === 'active').reduce((sum, c) => sum + cents(c.balance), 0)),
    tier: tier(s.points_lifetime),
    nextTier: nextTier(s.points_lifetime),
    badges: BADGES.map(([id, label, description]) => ({ id, label, description, earned: earned.has(id) })),
    stats: s,
    referral: { code, link: `${siteUrl}/?ref=${code}`, percent: settings.affiliatePercent, orders: s.referral_orders, points: s.referral_points },
    history: [...(account.points_history ?? [])].reverse(),
    giftCards: cards.bought,
    giftCardsReceived: cards.received,
    business: account.business ?? null,
    rules: {
      pointsPerDollarSpent: settings.pointsPerDollarSpent, pointsPerDollar: POINTS_PER_DOLLAR,
      affiliatePercent: settings.affiliatePercent, businessFeePercent: settings.businessFeePercent,
      tiers: TIERS.map(([name, points]) => ({ name, points })), giftCardPresets: GIFT_CARD_PRESETS,
      giftCardMin: GIFT_CARD_MIN, giftCardMax: GIFT_CARD_MAX,
    },
  };
}

// One row per rewards account, for the admin console.
export function adminAccountRow(a) {
  const s = stats(a);
  return {
    sub: a._id, email: a.email ?? '', name: a.name ?? '', ...s, tier: tier(s.points_lifetime),
    badges: badges(a).map(b => b.label), referralCode: a.referral_code ?? null, business: a.business ?? null,
    note: a.admin_note ?? '',
  };
}
