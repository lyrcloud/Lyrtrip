'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import HelicopterForm from '@/components/HelicopterForm';
import { heliCall, HELI_ICON, HELI_STATUS_STYLE, NEW_MEDICAL, NEW_PASSENGER, type HeliDraft, type HeliOptions, type HeliRequest, type HeliService } from '@/lib/helicopter';
import { rememberReturnTo } from '@/lib/returnTo';

const primary = 'px-5 py-3 bg-btn text-white rounded-xl font-bold hover:bg-btn-hover disabled:bg-gray-300 transition';

const NAME: Record<HeliService, string> = { helicopter: 'helicopter', seaplane: 'seaplane', ambulance: 'air ambulance' };
const INTRO: Record<HeliService, [string, string]> = {
  helicopter: ['Helicopter charters through Lyrtrip', 'Transfers, airport hops, scenic tours, pilgrimages, weddings and filming.'],
  seaplane: ['Seaplane flights through Lyrtrip', 'Resort and island transfers, island hopping, scenic flights and remote lodges.'],
  ambulance: ['Air ambulance through Lyrtrip', 'Air ambulance jets and helicopters, airline stretcher escorts and medical repatriation, with doctors or nurses on board.'],
};

// Helicopter, Seaplane and Air ambulance tabs: charter through Lyrtrip. Lyrtrip finds the operator,
// quotes one price (plus the service charge), and books it once the customer pays.
export default function HelicopterPanel({ service }: { service: HeliService }) {
  const { user, loading } = useAuth();
  const [opts, setOpts] = useState<HeliOptions | null>(null);
  const [draft, setDraft] = useState<HeliDraft | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<HeliRequest | null>(null);

  // Loads the form; once signed in, fills in the customer's name and email (kept if already typed)
  useEffect(() => {
    heliCall<HeliOptions>({ action: 'options' })
      .then(o => {
        setOpts(o);
        setDraft(prev => {
          const d: HeliDraft = prev ?? {
            service, medical: { ...NEW_MEDICAL }, charter: Object.keys(o.services[service].charters)[0], roundTrip: false, from: '', to: '', date: '', time: '', returnDate: '', returnTime: '', flexibleDates: false,
            hours: '1', aircraft: o.services[service].aircraft[0], contact: { name: '', email: '', phone: '', country: '' },
            passengers: [{ ...NEW_PASSENGER }], luggageKg: '', budget: '', note: '',
          };
          if (!user || d.contact.email) return d;
          return {
            ...d, contact: { ...d.contact, name: d.contact.name || user.name || '', email: user.email ?? '' },
            passengers: d.passengers.map((p, i) => (i === 0 && !p.fullName ? { ...p, fullName: user.name ?? '' } : p)),
          };
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load the charter form.'));
  }, [user, service]);

  const submit = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const r = await heliCall<{ request: HeliRequest }>({ action: 'request', ...draft, acceptTerms: terms });
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
      <div className="rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 ring-1 ring-sky-100 p-4">
        <p className="font-bold text-gray-900">{HELI_ICON[service]} {INTRO[service][0]}</p>
        <p className="text-sm text-gray-600">
          {INTRO[service][1]} Tell us the route and {service === 'ambulance' ? 'the patient' : 'passengers'}: we find a licensed operator,
          send you one all-in price (plus our {pct}% service charge), and book it once you pay. <Link href="/helicopter/requests" className="font-semibold text-brand-600">My charters →</Link>
        </p>
      </div>
      {service === 'ambulance' && (
        <p role="note" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          <b>Not for emergencies.</b> If someone&apos;s life is in danger, call your local emergency number now (112, 911, 999 or 108).
          Air ambulance flights are arranged with the treating doctor and need the operator&apos;s medical team to confirm the patient is fit to fly.
        </p>
      )}

      {done ? (
        <div className="rounded-2xl ring-1 ring-gray-100 bg-white p-5 space-y-3">
          <p><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${HELI_STATUS_STYLE[done.status] ?? ''}`}>{done.statusLabel}</span></p>
          <p className="text-sm text-gray-700">
            Lyrtrip is checking {done.serviceLabel.toLowerCase()} operators for {done.to ? `${done.from} → ${done.to}` : done.from} on {done.date}. We will email you the price: the charter plus
            our {pct}% service charge. Nothing is charged until you pay that quote.
          </p>
          <div className="flex gap-3">
            <Link href="/helicopter/requests" className="text-sm font-semibold text-brand-600">See my charters →</Link>
            <button type="button" onClick={() => { setDone(null); setTerms(false); }} className="text-sm font-semibold text-gray-600 underline">Request another</button>
          </div>
        </div>
      ) : !opts || !draft ? (
        error ? <p className="text-sm text-red-700">{error}</p> : <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>
      ) : (
        <>
          <HelicopterForm draft={draft} setDraft={setDraft} opts={opts} />
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-0.5" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>
              I understand Lyrtrip books this {NAME[service]} charter for me with a licensed operator. I pay the quoted charter price plus Lyrtrip&apos;s {pct}% service charge;
              the quote is valid for {opts.quoteHours} hours. Flights depend on weather and the operator&apos;s safety checks, and once booked they follow the
              operator&apos;s cancellation rules. If Lyrtrip can&apos;t book it, I get a full refund.
            </span>
          </label>
          {error && <div role="alert" className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
          {!loading && !user ? (
            <Link href="/login" onClick={() => rememberReturnTo('/?tab=helicopter')} className={`${primary} inline-block`}>Sign in to request a quote</Link>
          ) : (
            <button type="button" onClick={submit} disabled={busy || !terms || loading} className={`${primary} w-full sm:w-auto`}>{busy ? 'Sending…' : 'Get a charter quote'}</button>
          )}
        </>
      )}
    </div>
  );
}
