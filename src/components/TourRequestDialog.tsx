'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import TourRequestForm, { type TourDraft } from '@/components/TourRequestForm';
import { toursCall, NEW_TRAVELLER, TOUR_STATUS_STYLE, type TourOptions, type TourRequest, type TourSpec } from '@/lib/tours';
import { rememberReturnTo } from '@/lib/returnTo';

export interface TourItem { name: string; placeType?: string | null; address?: string | null; applyToken: string }

interface FormReply { spec: TourSpec; serviceRate: number; quoteHours: number; maxTravellers: number; options: TourOptions; from: string; destination: string }

const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';

// Booking a package or travel service through Lyrtrip: the customer sends everything, Lyrtrip quotes and books
export default function TourRequestDialog({ item, onClose }: { item: TourItem; onClose: () => void }) {
  const { user, loading } = useAuth();
  const [form, setForm] = useState<FormReply | null>(null);
  const [draft, setDraft] = useState<TourDraft | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<TourRequest | null>(null);

  useEffect(() => {
    if (!user) return;
    toursCall<FormReply>({ action: 'form', token: item.applyToken })
      .then(f => {
        setForm(f);
        setDraft({
          contact: { name: user.name ?? '', email: user.email ?? '', phone: '', country: '' },
          trip: { from: f.from, destination: f.destination, startDate: '', nights: '', flexibleDays: '', hotel: '', rooms: '', meals: '', flights: false, budgetPerPerson: '' },
          travellers: [{ ...NEW_TRAVELLER, fullName: user.name ?? '', idType: f.spec.passport ? 'Passport' : '' }],
          extras: {}, specialNeeds: '', note: '', docs: [],
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load the form.'));
  }, [user, item.applyToken]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const r = await toursCall<{ request: TourRequest }>({ action: 'request', token: item.applyToken, ...draft, acceptTerms: terms });
      setDone(r.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request failed. Please try again.');
    }
    setBusy(false);
  };

  const pct = Math.round((form?.serviceRate ?? 0.05) * 100);
  let body: React.ReactNode;
  if (!loading && !user) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Sign in to book. Lyrtrip arranges everything for you and quotes one price.</p>
        <Link href="/login" onClick={() => rememberReturnTo('/')} className={`${primary} inline-block`}>Sign in to book</Link>
      </div>
    );
  } else if (done) {
    body = (
      <div className="space-y-3">
        <p><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${TOUR_STATUS_STYLE[done.status] ?? ''}`}>{done.statusLabel}</span></p>
        <p className="text-sm text-gray-700">
          Lyrtrip checks availability and your documents, then emails you the price: the package plus our {pct}% service charge. Nothing is charged until you pay that quote.
        </p>
        <Link href="/tours/requests" className="text-sm font-semibold text-brand-600">See my requests →</Link>
      </div>
    );
  } else if (!form || !draft) {
    body = error ? null : <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>;
  } else {
    body = (
      <div className="space-y-4">
        <TourRequestForm spec={form.spec} options={form.options} maxTravellers={form.maxTravellers} draft={draft} setDraft={setDraft} />
        <label className="flex items-start gap-2 text-xs text-gray-600">
          <input type="checkbox" className="mt-0.5" checked={terms} onChange={e => setTerms(e.target.checked)} />
          <span>
            I understand Lyrtrip arranges this for me. I pay the quoted price plus Lyrtrip&apos;s {pct}% service charge, and the quote is valid
            for {form.quoteHours} hours. Once booked, the providers&apos; cancellation rules apply; if Lyrtrip can&apos;t book it, I get a full refund.
            My details and documents are used only for this booking.
          </span>
        </label>
        {error && <div className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
        <button onClick={submit} disabled={busy || !terms} className={`${primary} w-full`}>{busy ? 'Sending…' : 'Send request'}</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Book ${item.name}`}
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">{form?.spec.label ?? 'Book'} via Lyrtrip</p>
            <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
            {(item.placeType || item.address) && <p className="text-sm text-gray-600">{[item.placeType, item.address].filter(Boolean).join(' · ')}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        {error && !form && <div className="mb-3 rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
        {body}
      </div>
    </div>
  );
}
