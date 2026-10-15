'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import EventTicketForm, { type EventTicketDraft } from '@/components/EventTicketForm';
import { eventsCall, EVENT_STATUS_STYLE, NEW_ATTENDEE, type EventTicketOptions, type EventTicketRequest } from '@/lib/events';
import { rememberReturnTo } from '@/lib/returnTo';

export interface TicketEvent { name: string; when?: string | null; venue?: string | null; address?: string | null; applyToken: string }

const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';

// Buying tickets through Lyrtrip: the customer sends a request, Lyrtrip quotes the price and buys the tickets
export default function EventTicketDialog({ item, onClose }: { item: TicketEvent; onClose: () => void }) {
  const { user, loading } = useAuth();
  const [opts, setOpts] = useState<EventTicketOptions | null>(null);
  const [draft, setDraft] = useState<EventTicketDraft | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<EventTicketRequest | null>(null);

  useEffect(() => {
    if (!user) return;
    eventsCall<EventTicketOptions>({ action: 'options' })
      .then(o => {
        setOpts(o);
        setDraft({
          contact: { name: user.name ?? '', email: user.email ?? '', phone: '', country: '' },
          attendees: [{ ...NEW_ATTENDEE, fullName: user.name ?? '' }], ticketType: o.ticketTypes[0], seatTogether: true,
          maxPerTicket: '', eventDate: '', accessibility: '', note: '',
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load the ticket form.'));
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const r = await eventsCall<{ request: EventTicketRequest }>({ action: 'request', token: item.applyToken, ...draft, acceptTerms: terms });
      setDone(r.request);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The request failed. Please try again.');
    }
    setBusy(false);
  };

  const pct = Math.round((opts?.serviceRate ?? 0.05) * 100);
  let body: React.ReactNode;
  if (!loading && !user) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Sign in to get tickets. Lyrtrip finds them, tells you the price, and books them for you.</p>
        <Link href="/login" onClick={() => rememberReturnTo('/')} className={`${primary} inline-block`}>Sign in to get tickets</Link>
      </div>
    );
  } else if (done) {
    body = (
      <div className="space-y-3">
        <p><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${EVENT_STATUS_STYLE[done.status] ?? ''}`}>{done.statusLabel}</span></p>
        <p className="text-sm text-gray-700">
          Lyrtrip checks availability and emails you the price: the tickets plus our {pct}% service charge. Nothing is charged until you pay that quote.
        </p>
        <Link href="/events/tickets" className="text-sm font-semibold text-brand-600">See my tickets →</Link>
      </div>
    );
  } else if (!opts || !draft) {
    body = error ? null : <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>;
  } else {
    body = (
      <div className="space-y-4">
        <EventTicketForm draft={draft} setDraft={setDraft} ticketTypes={opts.ticketTypes} idTypes={opts.idTypes} maxTickets={opts.maxTickets} />
        <label className="flex items-start gap-2 text-xs text-gray-600">
          <input type="checkbox" className="mt-0.5" checked={terms} onChange={e => setTerms(e.target.checked)} />
          <span>
            I understand Lyrtrip buys these tickets for me. I pay the quoted ticket price plus Lyrtrip&apos;s {pct}% service charge.
            The quote is valid for {opts.quoteHours} hours. Once the tickets are bought they follow the event&apos;s own refund rules;
            if Lyrtrip can&apos;t get them, I get a full refund.
          </span>
        </label>
        <button onClick={submit} disabled={busy || !terms} className={`${primary} w-full`}>{busy ? 'Sending…' : 'Request tickets'}</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Tickets for ${item.name}`}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Tickets via Lyrtrip</p>
            <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
            <p className="text-sm text-gray-600">{[item.when, item.venue || item.address].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        {error && <div className="mb-3 rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
        {body}
      </div>
    </div>
  );
}
