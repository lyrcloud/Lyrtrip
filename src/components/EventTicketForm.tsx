'use client';

import type { EventAttendee, EventContact } from '@/lib/events';
import { NEW_ATTENDEE } from '@/lib/events';

export interface EventTicketDraft {
  contact: EventContact; attendees: EventAttendee[]; ticketType: string; seatTogether: boolean;
  maxPerTicket: string; eventDate: string; accessibility: string; note: string;
}

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const req = <span className="text-red-500">*</span>;

// Everything needed to buy named tickets: the buyer, each attendee's ID details, and seat preferences
export default function EventTicketForm({ draft, setDraft, ticketTypes, idTypes, maxTickets }: {
  draft: EventTicketDraft; setDraft: (d: EventTicketDraft) => void; ticketTypes: string[]; idTypes: string[]; maxTickets: number;
}) {
  const setContact = (k: keyof EventContact, v: string) => setDraft({ ...draft, contact: { ...draft.contact, [k]: v } });
  const setAttendee = (i: number, k: keyof EventAttendee, v: string) =>
    setDraft({ ...draft, attendees: draft.attendees.map((a, j) => (j === i ? { ...a, [k]: v } : a)) });
  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(maxTickets, n));
    setDraft({ ...draft, attendees: Array.from({ length: count }, (_, i) => draft.attendees[i] ?? { ...NEW_ATTENDEE }) });
  };
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Tickets {req}</label>
          <select className={input} value={draft.attendees.length} onChange={e => setCount(Number(e.target.value))}>
            {Array.from({ length: maxTickets }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Ticket type</label>
          <select className={input} value={draft.ticketType} onChange={e => setDraft({ ...draft, ticketType: e.target.value })}>
            {ticketTypes.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Most per ticket (USD)</label>
          <input className={input} type="number" min={1} step="1" value={draft.maxPerTicket} onChange={e => setDraft({ ...draft, maxPerTicket: e.target.value })} placeholder="No limit" />
        </div>
        <div>
          <label className={label}>Date / session</label>
          <input className={input} value={draft.eventDate} maxLength={60} onChange={e => setDraft({ ...draft, eventDate: e.target.value })} placeholder="If it runs on several days" />
        </div>
      </div>
      {draft.attendees.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={draft.seatTogether} onChange={e => setDraft({ ...draft, seatTogether: e.target.checked })} /> Seats together
        </label>
      )}

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-gray-900">Your details</legend>
        <p className="text-xs text-gray-500">The tickets and all updates go to this email.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Full name {req}</label><input className={input} value={draft.contact.name} maxLength={80} onChange={e => setContact('name', e.target.value)} autoComplete="name" /></div>
          <div><label className={label}>Email {req}</label><input className={input} type="email" value={draft.contact.email} maxLength={120} onChange={e => setContact('email', e.target.value)} autoComplete="email" /></div>
          <div><label className={label}>Phone with country code {req}</label><input className={input} type="tel" value={draft.contact.phone} maxLength={30} onChange={e => setContact('phone', e.target.value)} placeholder="+44 7700 900123" autoComplete="tel" /></div>
          <div><label className={label}>Country {req}</label><input className={input} value={draft.contact.country} maxLength={60} onChange={e => setContact('country', e.target.value)} autoComplete="country-name" /></div>
        </div>
      </fieldset>

      {draft.attendees.map((a, i) => (
        <fieldset key={i} className="space-y-3 rounded-xl ring-1 ring-gray-100 p-3">
          <legend className="px-1 text-sm font-bold text-gray-900">Attendee {i + 1}</legend>
          <p className="text-xs text-gray-500">As on the photo ID they will bring: many venues check that the name matches the ticket.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={label}>Full name as on ID {req}</label><input className={input} value={a.fullName} maxLength={80} onChange={e => setAttendee(i, 'fullName', e.target.value)} /></div>
            <div><label className={label}>Date of birth {req}</label><input className={input} type="date" max={today} value={a.dateOfBirth} onChange={e => setAttendee(i, 'dateOfBirth', e.target.value)} /></div>
            <div><label className={label}>Nationality {req}</label><input className={input} value={a.nationality} maxLength={60} onChange={e => setAttendee(i, 'nationality', e.target.value)} /></div>
            <div>
              <label className={label}>Photo ID {req}</label>
              <select className={input} value={a.idType} onChange={e => setAttendee(i, 'idType', e.target.value)}>
                <option value="">Choose…</option>
                {idTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className={label}>ID number {req}</label><input className={input} value={a.idNumber} maxLength={30} onChange={e => setAttendee(i, 'idNumber', e.target.value)} /></div>
          </div>
        </fieldset>
      ))}

      <div>
        <label className={label}>Accessibility needs</label>
        <input className={input} value={draft.accessibility} maxLength={500} onChange={e => setDraft({ ...draft, accessibility: e.target.value })} placeholder="e.g. wheelchair space, step-free access" />
      </div>
      <div>
        <label className={label}>Anything else (optional)</label>
        <textarea className={input} rows={2} maxLength={2000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. preferred section, aisle seats" />
      </div>
    </div>
  );
}
