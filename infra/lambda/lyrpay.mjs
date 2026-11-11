// Pay with Lyrpay: guests pay hotel requests and shipping labels from their Lyrpay balance (lyrpay.com, the Lyr
// wallet, on the same Lyr account). A Lyrpay payment stands in for a Stripe Checkout session: its id (lpp_…) is
// stored as the booking's stripeSessionId and paymentIntent, session() answers in Stripe's shape, so the confirm,
// release and refund steps only ask which kind they hold.
//
// Keys: LYRPAY_SECRET_KEY (lpk_lyrtrip_…) and LYRPAY_WEBHOOK_SECRET (lpwh_…) from lyrpay.com/#admin > Lyr apps,
// set from .env.local by infra/deploy-site.sh. Without them the option is off. Lyrpay posts a signed callback to
// /api/lyrpay/callback when a payment is paid, so a booking is processed even if the guest closes the tab.
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = () => (process.env.LYRPAY_API || 'https://lyrpay.com/api/v1').replace(/\/$/, '');
const SIGNATURE_AGE_S = 600;

export const enabled = () => /^lpk_/.test(process.env.LYRPAY_SECRET_KEY || '');
export const isLyrpay = id => /^lpp_[0-9a-f]{24}$/.test(String(id ?? ''));

async function call(method, path, body) {
  if (!enabled()) throw Object.assign(new Error('Pay with Lyrpay is not switched on'), { status: 503 });
  let res;
  try {
    res = await fetch(`${API()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${process.env.LYRPAY_SECRET_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'Lyrtrip/1' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw Object.assign(new Error("Lyrpay didn't answer. Please try again."), { status: 502 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.detail || `Lyrpay answered ${res.status}`), { status: res.status });
  return data;
}

// Opens a payment for amountCents (USD). Lyrpay sends the guest back to returnUrl / cancelUrl with
// ?lyrpay_payment=<id>&lyrpay_status=…, which the booking pages read as the session id.
// email only fills in Lyrpay's sign-up form; any Lyr account may still pay
export async function createCheckout({ amountCents, description, reference, metadata, siteUrl, type, email }) {
  const payment = await call('POST', '/payments', {
    amount: (amountCents / 100).toFixed(2), currency: 'USD', reference, description: String(description).slice(0, 140),
    returnUrl: `${siteUrl}/booking/success?type=${type}`, cancelUrl: `${siteUrl}/booking/cancel?type=${type}`,
    expiresInMinutes: 30, metadata, ...(/^\S+@\S+\.\S+$/.test(email || '') ? { email } : {}),
  });
  return { id: payment.id, url: payment.url };
}

// A Lyrpay payment in the shape the Stripe code reads: payment_status, status ('open' | 'complete' | 'expired'),
// metadata, payment_intent and amount_total.
export async function session(id) {
  const p = await call('GET', `/payments/${encodeURIComponent(id)}`);
  const status = p.status === 'pending' ? 'open' : ['expired', 'cancelled'].includes(p.status) ? 'expired' : 'complete';
  return {
    id: p.id, object: 'lyrpay.payment', status, payment_status: status === 'complete' ? 'paid' : 'unpaid',
    metadata: p.metadata ?? {}, payment_intent: p.id, amount_total: Math.round(Number(p.amount) * 100),
    currency: String(p.currency).toLowerCase(), lyrpay: p,
  };
}

export const refund = (id, amountCents) =>
  call('POST', `/payments/${encodeURIComponent(id)}/refund`, amountCents ? { amount: (amountCents / 100).toFixed(2) } : {});

// What the receipt shows about how it was paid (Stripe's version reads the card)
export const paymentDetails = s => ({
  brand: 'Lyrpay', last4: null, paidAt: s.lyrpay?.paidAt || new Date().toISOString(), receiptUrl: null, reference: s.id,
});

// The callback's JSON if its Lyrpay-Signature (t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">) is good, else null
export function verify(raw, header) {
  const secret = process.env.LYRPAY_WEBHOOK_SECRET;
  if (!secret || !header) return null;
  const parts = Object.fromEntries(String(header).split(',').map(p => p.split('=')).filter(p => p.length === 2));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || Math.abs(Date.now() / 1000 - t) > SIGNATURE_AGE_S) return null;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.`).update(raw).digest('hex'));
  const sent = Buffer.from(String(parts.v1 ?? ''));
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) return null;
  try {
    return JSON.parse(raw.toString('utf8'));
  } catch {
    return null;
  }
}
