'use client';

import { useState } from 'react';
import CheckoutExtras from '@/components/CheckoutExtras';
import { getReferral, idTokenOrNull, type CheckoutExtrasValue, type RewardsQuote } from '@/lib/rewards';

interface Stop { name: string; phone: string; line1: string; line2: string; city: string; state: string; postalCode: string; country: string; notes: string }
interface Quote { price: number; currency: string; pickupMinutes: number | null; totalMinutes: number | null }

const EMPTY: Stop = { name: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US', notes: '' };
const SIZES: [string, string][] = [['small', 'Small (fits in a bag)'], ['medium', 'Medium (a box)'], ['large', 'Large (needs a car)'], ['xlarge', 'Extra large']];

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100';
const label = 'block text-xs font-medium text-gray-600 mb-1';

// Same-day courier delivery, booked and paid on Lyrtrip (the courier partner's fee + 10%). With `food`, the courier
// collects a meal the customer has already ordered and paid for at a restaurant, and brings it to them.
export default function CourierDelivery({ user, food = false }: { user: { email?: string; name?: string } | null; food?: boolean }) {
  const [pickup, setPickup] = useState<Stop>({ ...EMPTY, name: food ? '' : user?.name ?? '' });
  const [dropoff, setDropoff] = useState<Stop>({ ...EMPTY, name: food ? user?.name ?? '' : '' });
  const [item, setItem] = useState({ description: '', size: 'small', value: '' });
  const [email, setEmail] = useState(user?.email ?? '');
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  const [agree, setAgree] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [extras, setExtras] = useState<CheckoutExtrasValue>({ couponCode: '', giftCardCode: '', usePoints: false });
  const [extrasQuote, setExtrasQuote] = useState<RewardsQuote | null>(null);
  const [loading, setLoading] = useState<'quote' | 'pay' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const payload = () => ({ pickup, dropoff, item: { ...item, description: food && item.description.trim() ? `Food order: ${item.description.trim()}` : item.description, value: Number(item.value) || 0 } });
  const stale = () => { setQuote(null); setError(null); };
  const setStop = (side: 'pickup' | 'dropoff', k: keyof Stop, v: string) => {
    (side === 'pickup' ? setPickup : setDropoff)(s => ({ ...s, [k]: v }));
    stale();
  };

  const getQuote = async () => {
    setLoading('quote');
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/delivery/quote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
      const data = await res.json().catch(() => ({}));
      if (data.price) setQuote(data);
      else setError(data.error ?? 'No courier is available for this delivery right now.');
    } catch {
      setError('Could not get a price right now. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const pay = async () => {
    if (!quote) return;
    if (!agree) { setError('Please confirm the item is allowed.'); return; }
    setLoading('pay');
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/delivery/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload(), email, leaveAtDoor, agreeProhibited: agree, quotedTotal: quote.price,
          ...extras, ref: getReferral(), idToken: await idTokenOrNull(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
      if (data.priceChanged && data.totalPrice) setQuote(q => q && { ...q, price: data.totalPrice });
      setError(data.error ?? 'Could not start checkout. Please try again.');
    } catch {
      setError('Could not reach the booking service. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const due = extrasQuote && quote && extrasQuote.listedTotal === quote.price ? extrasQuote.amountDue : quote?.price;
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: quote?.currency ?? 'USD' }).format(n);

  const stopFields = (side: 'pickup' | 'dropoff', s: Stop) => (
    <div className="rounded-2xl border border-gray-200 p-4 space-y-2">
      <p className="font-semibold text-gray-900">{side === 'pickup' ? (food ? '🍽️ Restaurant' : '📍 Pick up from') : '🏁 Deliver to'}</p>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={label}>{food && side === 'pickup' ? 'Restaurant name *' : 'Contact name *'}</label><input className={input} value={s.name} onChange={e => setStop(side, 'name', e.target.value)} /></div>
        <div><label className={label}>Phone *</label><input className={input} type="tel" placeholder="+1 718 555 0100" value={s.phone} onChange={e => setStop(side, 'phone', e.target.value)} /></div>
        <div className="col-span-2"><label className={label}>Street address *</label><input className={input} value={s.line1} onChange={e => setStop(side, 'line1', e.target.value)} /></div>
        <div><label className={label}>Apt / suite</label><input className={input} value={s.line2} onChange={e => setStop(side, 'line2', e.target.value)} /></div>
        <div><label className={label}>City *</label><input className={input} value={s.city} onChange={e => setStop(side, 'city', e.target.value)} /></div>
        <div><label className={label}>State</label><input className={input} value={s.state} onChange={e => setStop(side, 'state', e.target.value)} /></div>
        <div><label className={label}>ZIP / postal code</label><input className={input} value={s.postalCode} onChange={e => setStop(side, 'postalCode', e.target.value)} /></div>
        <div className="col-span-2"><label className={label}>Notes for the courier</label>
          <input className={input} maxLength={280} placeholder={side === 'pickup' ? (food ? 'e.g. Collect order #482 under Priya at the counter' : 'e.g. Ask at the front desk') : 'e.g. Buzz 4B, leave with doorman'} value={s.notes} onChange={e => setStop(side, 'notes', e.target.value)} /></div>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/30 p-4 sm:p-5 mb-8 space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl">{food ? '🍱' : '🛵'}</span>
        <div>
          <h3 className="text-lg font-bold text-gray-900">{food ? 'Food delivery from any restaurant' : 'Send anything across town'}</h3>
          <p className="text-sm text-gray-600">{food
            ? 'Order and pay at the restaurant for pickup, then a Lyrtrip courier collects it and brings it to you, usually within the hour.'
            : 'A courier picks it up and delivers it today, usually within the hour. Book, pay and track it all here.'}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {stopFields('pickup', pickup)}
        {stopFields('dropoff', dropoff)}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 grid sm:grid-cols-4 gap-2">
        <div className="sm:col-span-2"><label className={label}>{food ? 'Your order *' : 'What are we delivering? *'}</label>
          <input className={input} placeholder={food ? 'e.g. Order #482: 2 bags, hot food' : 'e.g. House keys, documents, a gift'} value={item.description} onChange={e => { setItem({ ...item, description: e.target.value }); stale(); }} /></div>
        <div><label className={label}>Size</label>
          <select className={input} value={item.size} onChange={e => { setItem({ ...item, size: e.target.value }); stale(); }}>
            {SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
        <div><label className={label}>Value ($)</label>
          <input className={input} type="number" min={0} max={1000} value={item.value} onChange={e => { setItem({ ...item, value: e.target.value }); stale(); }} /></div>
      </div>

      <button onClick={getQuote} disabled={loading !== null}
        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60">
        {loading === 'quote' ? 'Finding a courier…' : 'Get a price →'}
      </button>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

      {quote && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm text-gray-500">Lyrtrip courier, all fees included</p>
              <p className="text-3xl font-bold text-gray-900">{fmt(quote.price)}</p>
            </div>
            <p className="text-sm text-gray-600">
              {quote.pickupMinutes != null && <>Pickup in ~{quote.pickupMinutes} min</>}
              {quote.totalMinutes != null && <> · delivered in ~{quote.totalMinutes} min</>}
            </p>
          </div>
          <CheckoutExtras kind="delivery" listedTotal={quote.price} currency={quote.currency} signedIn={!!user}
            value={extras} onChange={v => { setExtras(v); setError(null); }} onQuote={setExtrasQuote} />
          <div><label className={label}>Your email (receipt and tracking link) *</label>
            <input className={input} type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={leaveAtDoor} onChange={e => setLeaveAtDoor(e.target.checked)} />
            Leave at the door if nobody answers (otherwise the courier brings it back)
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>The item is legal and allowed (no alcohol, tobacco, weapons, cash, medicines or hazardous goods), and is ready for pickup now.</span>
          </label>
          <button onClick={pay} disabled={loading !== null}
            className="w-full py-3 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 disabled:opacity-60">
            {loading === 'pay' ? 'Opening checkout…' : `Pay ${fmt(due ?? quote.price)} and book courier →`}
          </button>
        </div>
      )}
    </div>
  );
}
