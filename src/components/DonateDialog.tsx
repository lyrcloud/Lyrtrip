'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { donationsCall, type Charity, type CharityCatalog } from '@/lib/donations';

const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';
const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const PRESETS = [10, 25, 50, 100, 250, 500];
const usd = (n: number) => `$${n.toFixed(2)}`;

// A one-off card donation through Lyrtrip: the gift goes to the charity in full, plus Lyrtrip's service charge
export default function DonateDialog({ charity, cause, catalog, initialAmount, initialType, onClose }: {
  charity: Charity; cause: string; catalog: CharityCatalog; initialAmount?: number; initialType?: string; onClose: () => void;
}) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number | ''>(initialAmount ?? 50);
  const [giftType, setGiftType] = useState(initialType ?? (cause === 'zakat' ? 'Zakat' : cause === 'sadaqah' ? 'Sadaqah' : 'General donation'));
  const [donor, setDonor] = useState({ name: user?.name ?? '', email: user?.email ?? '', country: '', anonymous: false });
  const [dedication, setDedication] = useState('');
  const [message, setMessage] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const value = Number(amount) || 0;
  const service = Math.round(value * catalog.serviceRate * 100) / 100;
  const types = catalog.giftTypes.filter(t => t !== 'Zakat' || charity.zakat);

  const donate = async () => {
    setBusy(true); setError(null);
    try {
      const { url } = await donationsCall<{ url: string }>({ action: 'donate', charityId: charity.id, cause, amount: value, giftType, donor, dedication, message, acceptTerms: terms });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The donation failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Donate to ${charity.name}`}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Donate via Lyrtrip</p>
            <h2 className="text-lg font-bold text-gray-900">{charity.name}</h2>
            <p className="text-sm text-gray-600">{charity.regions}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <p className={label}>Amount (USD)</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESETS.map(p => (
                <button key={p} type="button" onClick={() => setAmount(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ring-1 ${amount === p ? 'bg-btn text-white ring-btn' : 'bg-white text-gray-700 ring-gray-200'}`}>${p}</button>
              ))}
            </div>
            <input className={input} type="number" min={catalog.min} max={catalog.max} step="0.01" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Other amount" />
          </div>
          <div>
            <label className={label}>Type of gift</label>
            <select className={input} value={giftType} onChange={e => setGiftType(e.target.value)}>
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
            {!charity.zakat && cause === 'zakat' && <p className="mt-1 text-xs text-amber-700">This charity has no zakat fund; choose a zakat charity to give zakat.</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={label}>Your name <span className="text-red-500">*</span></label><input className={input} value={donor.name} maxLength={80} onChange={e => setDonor({ ...donor, name: e.target.value })} autoComplete="name" /></div>
            <div><label className={label}>Email for your receipt <span className="text-red-500">*</span></label><input className={input} type="email" value={donor.email} maxLength={120} onChange={e => setDonor({ ...donor, email: e.target.value })} autoComplete="email" /></div>
            <div><label className={label}>Country</label><input className={input} value={donor.country} maxLength={60} onChange={e => setDonor({ ...donor, country: e.target.value })} autoComplete="country-name" /></div>
            <div><label className={label}>In honour or memory of (optional)</label><input className={input} value={dedication} maxLength={200} onChange={e => setDedication(e.target.value)} /></div>
          </div>
          <div><label className={label}>Message (optional)</label><input className={input} value={message} maxLength={500} onChange={e => setMessage(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={donor.anonymous} onChange={e => setDonor({ ...donor, anonymous: e.target.checked })} /> Give anonymously (your name is not passed to the charity)
          </label>
          <div className="rounded-xl bg-gray-50 ring-1 ring-gray-100 p-3 text-sm space-y-1">
            <p className="flex justify-between"><span>Donation to {charity.name}</span><span>{usd(value)}</span></p>
            <p className="flex justify-between text-gray-600"><span>Lyrtrip service charge ({Math.round(catalog.serviceRate * 100)}%)</span><span>{usd(service)}</span></p>
            <p className="flex justify-between font-bold border-t border-gray-200 pt-1"><span>You pay</span><span>{usd(value + service)}</span></p>
          </div>
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-0.5" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>
              I understand Lyrtrip collects my donation and passes the full amount on to {charity.name}, and emails me when it has.
              Lyrtrip is not {charity.name} and is not affiliated with it. My receipt is a payment receipt from Lyrtrip, not a tax receipt.
            </span>
          </label>
          {error && <div className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
          <button onClick={donate} disabled={busy || !terms || value < catalog.min} className={`${primary} w-full`}>{busy ? 'Opening payment…' : `Donate ${usd(value + service)}`}</button>
        </div>
      </div>
    </div>
  );
}
