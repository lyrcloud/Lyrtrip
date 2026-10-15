'use client';

import { useEffect, useState } from 'react';
import DonateDialog from '@/components/DonateDialog';
import { donationsCall, type Charity, type CharityCatalog } from '@/lib/donations';

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const pill = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
  on ? 'bg-btn text-white shadow-sm' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand-300 hover:text-brand-700'}`;

// Charity events searched from the Events tab
export const CHARITY_EVENT_TYPES: [string, string][] = [
  ['charity fundraising events', 'Fundraisers'], ['children charity events', "Children's charity"], ['orphan fundraising dinners', 'Orphan fundraisers'],
  ['iftar fundraising dinners', 'Iftar fundraisers'], ['charity runs walks', 'Charity runs & walks'], ['charity galas auctions', 'Galas & auctions'],
  ['volunteering events', 'Volunteering'],
];

// Zakat on savings: 2.5% of zakatable wealth, once it is above the nisab for a full lunar year
function ZakatCalculator({ onGive }: { onGive: (amount: number) => void }) {
  const [v, setV] = useState({ cash: '', gold: '', investments: '', owed: '', debts: '', nisab: '' });
  const n = (x: string) => Math.max(0, Number(x) || 0);
  const wealth = n(v.cash) + n(v.gold) + n(v.investments) + n(v.owed) - n(v.debts);
  const due = v.nisab && wealth < n(v.nisab) ? 0 : Math.round(Math.max(0, wealth) * 0.025 * 100) / 100;
  const row: [keyof typeof v, string][] = [
    ['cash', 'Cash and bank savings'], ['gold', 'Gold and silver (current value)'], ['investments', 'Shares, funds and business stock'],
    ['owed', 'Money owed to you that you expect back'], ['debts', 'Debts and bills due now (deducted)'], ['nisab', 'Nisab today (value of 85 g gold or 595 g silver)'],
  ];
  return (
    <div className="rounded-2xl bg-emerald-50/60 ring-1 ring-emerald-100 p-4 mb-4">
      <p className="font-bold text-gray-900">🌙 Zakat calculator</p>
      <p className="text-xs text-gray-600 mb-3">All in USD. Zakat is 2.5% of wealth you have held above the nisab for a lunar year. Ask a scholar for your own situation.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {row.map(([k, l]) => (
          <div key={k}><label className="block text-xs font-semibold text-gray-600 mb-1">{l}</label>
            <input className={input} type="number" min={0} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-800">{v.nisab && wealth < n(v.nisab) ? 'Below the nisab: no zakat due.' : <>Zakat due: <b>${due.toFixed(2)}</b></>}</p>
        {due >= 1 && <button type="button" onClick={() => onGive(due)} className="px-4 py-2 bg-btn text-white rounded-lg text-sm font-semibold">Give ${due.toFixed(2)} zakat</button>}
      </div>
    </div>
  );
}

export default function CharityPanel({ onFindEvents }: { onFindEvents: (category: string) => void }) {
  const [catalog, setCatalog] = useState<CharityCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cause, setCause] = useState('children');
  const [give, setGive] = useState<{ charity: Charity; amount?: number; type?: string } | null>(null);
  const [zakatDue, setZakatDue] = useState<number | null>(null);

  useEffect(() => {
    donationsCall<CharityCatalog>({ action: 'charities' }).then(setCatalog).catch(err => setError(err instanceof Error ? err.message : 'Could not load charities.'));
  }, []);

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!catalog) return <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>;
  const list = catalog.charities.filter(c => c.causes.includes(cause));
  const pct = Math.round(catalog.serviceRate * 100);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Cause">
        {catalog.causes.map(c => (
          <button key={c.id} type="button" role="radio" aria-checked={cause === c.id} onClick={() => setCause(c.id)} className={pill(cause === c.id)}>
            <span aria-hidden>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Give to established charities through Lyrtrip. Your full donation is passed on to the charity you choose, plus a {pct}% Lyrtrip service charge, and we email you when it has reached them.
      </p>
      {cause === 'zakat' && <ZakatCalculator onGive={a => setZakatDue(a)} />}
      {zakatDue != null && cause === 'zakat' && <p className="mb-3 text-sm font-semibold text-emerald-800">Choose a zakat charity below to give ${zakatDue.toFixed(2)}.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map(c => (
          <div key={c.id} className="flex flex-col bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition animate-[panelIn_250ms_ease-out]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{c.regions}</span>
              {c.zakat && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">Zakat fund</span>}
            </div>
            <h3 className="mt-1 font-bold text-gray-900">{c.name}</h3>
            <p className="mt-1 text-sm text-gray-600 flex-1">{c.about}</p>
            <button type="button" onClick={() => setGive({ charity: c, amount: cause === 'zakat' && zakatDue ? zakatDue : undefined, type: cause === 'zakat' && c.zakat ? 'Zakat' : undefined })}
              className="mt-3 self-start px-4 py-1.5 bg-btn text-white text-sm font-semibold rounded-lg hover:bg-btn-hover transition">Donate via Lyrtrip →</button>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-gray-50 ring-1 ring-gray-100 p-4">
        <p className="font-bold text-gray-900">🎗️ Charity events</p>
        <p className="text-sm text-gray-600 mb-3">Fundraisers, charity runs, iftar dinners and galas near you. Tickets through Lyrtrip.</p>
        <div className="flex flex-wrap gap-2">
          {CHARITY_EVENT_TYPES.map(([value, name]) => (
            <button key={value} type="button" onClick={() => onFindEvents(value)} className={pill(false)}>{name}</button>
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-500">Lyrtrip is not affiliated with these charities. Names are shown so you can choose where your gift goes.</p>
      {give && <DonateDialog charity={give.charity} cause={cause} catalog={catalog} initialAmount={give.amount} initialType={give.type} onClose={() => setGive(null)} />}
    </div>
  );
}
