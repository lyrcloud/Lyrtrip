'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import FreightForm from '@/components/FreightForm';
import { freightCall, FREIGHT_ICON, FREIGHT_STATUS_STYLE, type FreightDraft, type FreightMode, type FreightOptions, type FreightRequest } from '@/lib/freight';
import { rememberReturnTo } from '@/lib/returnTo';

const primary = 'px-5 py-3 bg-btn text-white rounded-xl font-bold hover:bg-btn-hover disabled:bg-gray-300 transition';

const INTRO: Record<FreightMode, [string, string]> = {
  truck: ['Truck booking through Lyrtrip', 'Mini trucks, part and full loads, refrigerated, flatbed and tanker trucks, house moving and car carriers.'],
  freight: ['Cargo & containers through Lyrtrip', 'Sea freight (FCL and LCL), air cargo and express, rail, cross-border road, heavy project cargo and vehicle shipping, with customs clearance.'],
};

// Truck booking and Cargo & containers options: Lyrtrip finds the carrier, quotes one price (plus the
// service charge), books it once the customer pays, and posts tracking updates.
export default function FreightPanel({ mode }: { mode: FreightMode }) {
  const { user, loading } = useAuth();
  const [opts, setOpts] = useState<FreightOptions | null>(null);
  const [draft, setDraft] = useState<FreightDraft | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<FreightRequest | null>(null);

  // Loads the form; once signed in, fills in the customer's name and email (kept if already typed)
  useEffect(() => {
    freightCall<FreightOptions>({ action: 'options' })
      .then(o => {
        setOpts(o);
        setDraft(prev => {
          const d: FreightDraft = prev ?? {
            mode, category: Object.keys(o.modes[mode].categories)[0], from: '', to: '', readyDate: '', flexibleDates: false,
            cargo: { description: '', type: o.cargoTypes[0], weightKg: '', volumeCbm: '', pieces: '', packaging: o.packaging[0], dimensions: '', value: '', unNumber: '' },
            containers: { type: '', count: '1' }, incoterm: '', customs: false, insurance: false, loadingHelp: false,
            contact: { name: '', email: '', phone: '', country: '', company: '' }, budget: '', note: '',
          };
          if (!user || d.contact.email) return d;
          return { ...d, contact: { ...d.contact, name: d.contact.name || user.name || '', email: user.email ?? '' } };
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load the shipping form.'));
  }, [user, mode]);

  const submit = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const r = await freightCall<{ request: FreightRequest }>({ action: 'request', ...draft, acceptTerms: terms });
      setDone(r.request);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request failed. Please try again.');
    }
    setBusy(false);
  };

  const pct = Math.round((opts?.serviceRate ?? 0.1) * 100);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-sky-50 ring-1 ring-amber-100 p-4">
        <p className="font-bold text-gray-900">{FREIGHT_ICON[mode]} {INTRO[mode][0]}</p>
        <p className="text-sm text-gray-600">
          {INTRO[mode][1]} Tell us the route and cargo: we find a licensed carrier, send you one all-in price (plus our {pct}% service charge),
          book it once you pay and keep you updated until delivery. <Link href="/freight/requests" className="font-semibold text-brand-600">My shipments →</Link>
        </p>
      </div>

      {done ? (
        <div className="rounded-2xl ring-1 ring-gray-100 bg-white p-5 space-y-3">
          <p><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${FREIGHT_STATUS_STYLE[done.status] ?? ''}`}>{done.statusLabel}</span></p>
          <p className="text-sm text-gray-700">
            Lyrtrip is checking carriers for {done.from} → {done.to}. We will email you the price: the freight plus our {pct}% service charge.
            Nothing is charged until you pay that quote.
          </p>
          <div className="flex gap-3">
            <Link href="/freight/requests" className="text-sm font-semibold text-brand-600">See my shipments →</Link>
            <button type="button" onClick={() => { setDone(null); setTerms(false); }} className="text-sm font-semibold text-gray-600 underline">Request another</button>
          </div>
        </div>
      ) : !opts || !draft ? (
        error ? <p className="text-sm text-red-700">{error}</p> : <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>
      ) : (
        <>
          <FreightForm draft={draft} setDraft={setDraft} opts={opts} />
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-0.5" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>
              I understand Lyrtrip books this shipment for me with a licensed carrier. I pay the quoted price plus Lyrtrip&apos;s {pct}% service charge;
              the quote is valid for {opts.quoteHours} hours. Duties, taxes and port or storage charges not in the quote are mine to pay. The cargo
              is accurately described and legal to ship. If Lyrtrip can&apos;t book it, I get a full refund.
            </span>
          </label>
          {error && <div role="alert" className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
          {!loading && !user ? (
            <Link href="/login" onClick={() => rememberReturnTo(`/?tab=${mode}`)} className={`${primary} inline-block`}>Sign in to request a quote</Link>
          ) : (
            <button type="button" onClick={submit} disabled={busy || !terms || loading} className={`${primary} w-full sm:w-auto`}>{busy ? 'Sending…' : 'Get a shipping quote'}</button>
          )}
        </>
      )}
    </div>
  );
}
