'use client';

import { useMemo, useState } from 'react';
import CheckoutExtras from '@/components/CheckoutExtras';
import { getReferral, idTokenOrNull, type CheckoutExtrasValue, type RewardsQuote } from '@/lib/rewards';

interface Address {
  name: string; company: string; phone: string; email: string;
  line1: string; line2: string; city: string; state: string; postalCode: string; country: string;
}
interface Item { description: string; category: string; quantity: number; value: string }
interface Rate {
  id: string; courier: string; umbrella: string | null; logo: string | null;
  minDays: number | null; maxDays: number | null; price: number; currency: string; incoterms: string;
}

const CATEGORIES: [string, string][] = [
  ['fashion', 'Clothes & fashion'], ['shoes', 'Shoes'], ['documents', 'Documents'], ['books_collectibles', 'Books & collectibles'],
  ['health_beauty_non_liquid', 'Health & beauty (no liquids)'], ['health_beauty', 'Health & beauty'], ['jewelry', 'Jewelry'], ['watches', 'Watches'],
  ['bags_luggages', 'Bags & luggage'], ['toys', 'Toys'], ['board_games', 'Board games'], ['gaming', 'Gaming'], ['sport_leisure', 'Sport & leisure'],
  ['home_decor', 'Home decor'], ['home_appliances', 'Home appliances'], ['crafts', 'Crafts'], ['pet_accessory', 'Pet accessories'],
  ['dry_food_supplements', 'Dry food & supplements'], ['mobile_phones', 'Mobile phones'], ['tablets', 'Tablets'], ['computers_laptops', 'Computers & laptops'],
  ['cameras', 'Cameras'], ['audio_video', 'Audio & video'], ['accessory_no_battery', 'Accessory (no battery)'], ['accessory_with_battery', 'Accessory (with battery)'],
];

// ISO 3166 country codes, named in the visitor's language
const COUNTRY_CODES = ('AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ '
  + 'DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP '
  + 'KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ '
  + 'OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ '
  + 'UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');

const EMPTY: Address = { name: '', company: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: '' };
const NEEDS_STATE = new Set(['US', 'CA', 'MX', 'AU']);

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-medium text-gray-600 mb-1';

export default function ShippingTab({ user }: { user: { email?: string; name?: string } | null }) {
  const [from, setFrom] = useState<Address>({ ...EMPTY, email: user?.email ?? '', name: user?.name ?? '' });
  const [to, setTo] = useState<Address>(EMPTY);
  const [parcel, setParcel] = useState({ weightKg: '1', lengthCm: '30', widthCm: '20', heightCm: '10' });
  const [items, setItems] = useState<Item[]>([{ description: '', category: 'fashion', quantity: 1, value: '' }]);
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [international, setInternational] = useState(false);
  const [chosen, setChosen] = useState<Rate | null>(null);
  const [agree, setAgree] = useState(false);
  const [extras, setExtras] = useState<CheckoutExtrasValue>({ couponCode: '', giftCardCode: '', usePoints: false });
  const [quote, setQuote] = useState<RewardsQuote | null>(null);
  const [loading, setLoading] = useState<'rates' | 'pay' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames(undefined, { type: 'region' }); } catch { /* old browser */ }
    return COUNTRY_CODES.map(c => [c, names?.of(c) ?? c] as const).sort((a, b) => a[1].localeCompare(b[1]));
  }, []);

  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const payload = () => ({
    from, to,
    parcel: { ...parcel, items: items.map(i => ({ ...i, value: Number(i.value) || 0 })) },
  });
  // Any change to the shipment means the rates shown are stale
  const touch = () => { setRates(null); setChosen(null); setError(null); };
  const setAddr = (side: 'from' | 'to', k: keyof Address, v: string) => {
    (side === 'from' ? setFrom : setTo)(a => ({ ...a, [k]: v }));
    if (['city', 'state', 'postalCode', 'country', 'line1'].includes(k)) touch();
  };

  const getRates = async () => {
    setLoading('rates');
    setError(null);
    setChosen(null);
    try {
      const res = await fetch(`${baseUrl}/api/ship/rates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
      const data = await res.json().catch(() => ({}));
      setRates(data.rates ?? []);
      setInternational(!!data.international);
      if (data.error) setError(data.error);
    } catch {
      setError('Could not reach the shipping service. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const pay = async () => {
    if (!chosen) return;
    if (!agree) { setError('Please confirm the parcel has no prohibited items.'); return; }
    setLoading('pay');
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/api/ship/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload(), courierServiceId: chosen.id, quotedTotal: chosen.price, agreeProhibited: agree,
          ...extras, ref: getReferral(), idToken: await idTokenOrNull(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
      if (data.priceChanged) void getRates();
      setError(data.error ?? 'Could not start checkout. Please try again.');
    } catch {
      setError('Could not reach the shipping service. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const cheapest = rates?.length ? rates[0].id : null;
  const fastest = rates?.length ? [...rates].sort((a, b) => (a.maxDays ?? 99) - (b.maxDays ?? 99))[0].id : null;
  const amountDue = quote && chosen && quote.listedTotal === chosen.price ? quote.amountDue : chosen?.price;

  const addressFields = (side: 'from' | 'to', a: Address) => (
    <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
      <p className="font-semibold text-gray-900">{side === 'from' ? '📤 From (sender)' : '📥 To (recipient)'}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 sm:col-span-1"><label className={label}>Full name *</label><input className={input} value={a.name} onChange={e => setAddr(side, 'name', e.target.value)} /></div>
        <div className="col-span-2 sm:col-span-1"><label className={label}>Company</label><input className={input} value={a.company} onChange={e => setAddr(side, 'company', e.target.value)} /></div>
        <div><label className={label}>Phone *</label><input className={input} type="tel" placeholder="+1 415 555 2671" value={a.phone} onChange={e => setAddr(side, 'phone', e.target.value)} /></div>
        <div><label className={label}>Email *</label><input className={input} type="email" value={a.email} onChange={e => setAddr(side, 'email', e.target.value)} /></div>
        <div className="col-span-2"><label className={label}>Street address *</label><input className={input} value={a.line1} onChange={e => setAddr(side, 'line1', e.target.value)} /></div>
        <div className="col-span-2"><label className={label}>Apartment, suite (optional)</label><input className={input} value={a.line2} onChange={e => setAddr(side, 'line2', e.target.value)} /></div>
        <div><label className={label}>City *</label><input className={input} value={a.city} onChange={e => setAddr(side, 'city', e.target.value)} /></div>
        <div><label className={label}>State / province{NEEDS_STATE.has(a.country) ? ' *' : ''}</label><input className={input} value={a.state} onChange={e => setAddr(side, 'state', e.target.value)} /></div>
        <div><label className={label}>Postal code</label><input className={input} value={a.postalCode} onChange={e => setAddr(side, 'postalCode', e.target.value)} /></div>
        <div>
          <label className={label}>Country *</label>
          <select className={input} value={a.country} onChange={e => setAddr(side, 'country', e.target.value)}>
            <option value="">Choose…</option>
            {countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-gray-900">Send a parcel anywhere</h3>
        <p className="text-sm text-gray-600">Compare live rates from USPS, FedEx, UPS, DHL and more, pay once, and print your label.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {addressFields('from', from)}
        {addressFields('to', to)}
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
        <p className="font-semibold text-gray-900">📦 Parcel</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([['weightKg', 'Weight (kg)'], ['lengthCm', 'Length (cm)'], ['widthCm', 'Width (cm)'], ['heightCm', 'Height (cm)']] as const).map(([k, l]) => (
            <div key={k}><label className={label}>{l} *</label>
              <input className={input} type="number" min={0} step="0.1" value={parcel[k]} onChange={e => { setParcel({ ...parcel, [k]: e.target.value }); touch(); }} /></div>
          ))}
        </div>
        <p className="text-xs font-medium text-gray-600 pt-1">What&apos;s inside (needed for customs)</p>
        {items.map((it, i) => {
          const set = (patch: Partial<Item>) => { setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x))); touch(); };
          return (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 sm:col-span-4"><input className={input} placeholder="Description, e.g. cotton T-shirts" value={it.description} onChange={e => set({ description: e.target.value })} /></div>
              <div className="col-span-6 sm:col-span-4">
                <select className={input} value={it.category} onChange={e => set({ category: e.target.value })}>
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-3 sm:col-span-1"><input className={input} type="number" min={1} title="Quantity" value={it.quantity} onChange={e => set({ quantity: Number(e.target.value) })} /></div>
              <div className="col-span-3 sm:col-span-2"><input className={input} type="number" min={0} placeholder="Value $" value={it.value} onChange={e => set({ value: e.target.value })} /></div>
              <div className="col-span-12 sm:col-span-1 text-right">
                {items.length > 1 && <button type="button" onClick={() => { setItems(items.filter((_, j) => j !== i)); touch(); }} className="text-xs text-red-600 hover:underline">Remove</button>}
              </div>
            </div>
          );
        })}
        {items.length < 10 && (
          <button type="button" onClick={() => setItems([...items, { description: '', category: 'fashion', quantity: 1, value: '' }])} className="text-sm font-medium text-brand-600 hover:underline">
            + Add another item
          </button>
        )}
      </div>

      <button onClick={getRates} disabled={loading !== null}
        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-btn text-white font-semibold hover:bg-btn-hover disabled:opacity-60">
        {loading === 'rates' ? 'Finding couriers…' : 'Compare courier rates →'}
      </button>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

      {rates && rates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">{rates.length} courier option{rates.length !== 1 ? 's' : ''} · prices include taxes, fuel surcharges and the Lyrtrip service fee</p>
          {rates.map(r => (
            <button key={r.id} type="button" onClick={() => { setChosen(r); setError(null); }}
              className={`w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition ${chosen?.id === r.id ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              {r.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={r.logo} alt="" className="w-12 h-12 object-contain rounded-lg bg-white" />
                : <span className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">📦</span>}
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-gray-900 truncate">{r.courier}</span>
                <span className="block text-sm text-gray-500">
                  {r.minDays != null ? `${r.minDays === r.maxDays ? r.minDays : `${r.minDays}–${r.maxDays}`} business days` : 'Delivery time varies'}
                </span>
                <span className="flex gap-1 mt-1">
                  {r.id === cheapest && <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">Cheapest</span>}
                  {r.id === fastest && <span className="text-xs rounded-full bg-sky-50 text-sky-700 px-2 py-0.5">Fastest</span>}
                </span>
              </span>
              <span className="text-lg font-bold text-gray-900">${r.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      {chosen && (
        <div className="rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="font-semibold text-gray-900">Pay for your {chosen.courier} label</p>
          <CheckoutExtras kind="shipping" listedTotal={chosen.price} currency="USD" signedIn={!!user}
            value={extras} onChange={v => { setExtras(v); setError(null); }} onQuote={setQuote} />
          {international && (
            <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
              International: the recipient may have to pay import duties and taxes on delivery (DDU). Declare the true contents and value for customs.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>The parcel has no prohibited or dangerous items (e.g. lithium batteries shipped loose, flammable liquids, weapons, cash, illegal goods), and the details above are true.</span>
          </label>
          <p className="text-xs text-gray-500">After payment you get the label to print and a tracking link by email. Hand the parcel to the courier or book a pickup.</p>
          <button onClick={pay} disabled={loading !== null}
            className="w-full py-3 rounded-xl bg-btn text-white font-semibold hover:bg-btn-hover disabled:opacity-60">
            {loading === 'pay' ? 'Opening checkout…' : `Pay $${(amountDue ?? chosen.price).toFixed(2)} →`}
          </button>
        </div>
      )}
    </div>
  );
}
