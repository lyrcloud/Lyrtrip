'use client';

import { useRef, useState } from 'react';
import {
  DOC_ACCEPT, NEW_TRAVELLER, uploadTourDoc,
  type TourContact, type TourExtras, type TourOptions, type TourSpec, type TourTraveller, type TourTrip, type TourUploadedDoc,
} from '@/lib/tours';

export interface TourDraft {
  contact: TourContact; trip: TourTrip; travellers: TourTraveller[]; extras: TourExtras;
  specialNeeds: string; note: string; docs: TourUploadedDoc[];
}

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const legend = 'text-sm font-bold text-gray-900';
const req = <span className="text-red-500">*</span>;

// Everything a tour, pilgrimage or travel service needs: trip, travellers' ID details, the category's own
// questions and copies of the required documents
export default function TourRequestForm({ spec, options, maxTravellers, draft, setDraft, existingDocs = [] }: {
  spec: TourSpec; options: TourOptions; maxTravellers: number; draft: TourDraft; setDraft: (d: TourDraft) => void;
  existingDocs?: { kind: string; name: string }[];
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<string | null>(null);

  const setContact = (k: keyof TourContact, v: string) => setDraft({ ...draft, contact: { ...draft.contact, [k]: v } });
  const setTrip = (k: keyof TourTrip, v: TourTrip[keyof TourTrip]) => setDraft({ ...draft, trip: { ...draft.trip, [k]: v } });
  const setTraveller = (i: number, k: keyof TourTraveller, v: string) =>
    setDraft({ ...draft, travellers: draft.travellers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) });
  const setExtra = (id: string, v: TourExtras[string]) => setDraft({ ...draft, extras: { ...draft.extras, [id]: v } });
  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(maxTravellers, n));
    setDraft({ ...draft, travellers: Array.from({ length: count }, (_, i) => draft.travellers[i] ?? { ...NEW_TRAVELLER, idType: spec.passport ? 'Passport' : '' }) });
  };

  const pick = (kind: string) => { pendingKind.current = kind; fileRef.current?.click(); };
  const upload = async (file?: File) => {
    const kind = pendingKind.current;
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !kind) return;
    setUploading(kind); setUploadError(null);
    try {
      const doc = await uploadTourDoc(kind, file);
      setDraft({ ...draft, docs: [...draft.docs, doc] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'The upload failed');
    }
    setUploading(null);
  };
  const removeDoc = (key: string) => setDraft({ ...draft, docs: draft.docs.filter(d => d.key !== key) });

  const today = new Date().toISOString().slice(0, 10);
  const docRow = (d: { id: string; label: string }, required: boolean) => {
    const mine = draft.docs.filter(x => x.kind === d.id);
    const earlier = existingDocs.filter(x => x.kind === d.id);
    const have = mine.length + earlier.length > 0;
    return (
      <div key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{have ? '✅' : required ? '⬜' : '➖'} {d.label} {required && req}</p>
          {[...earlier.map(x => ({ key: '', name: x.name })), ...mine].map((x, i) => (
            <p key={x.key || `e${i}`} className="text-xs text-gray-500 truncate">
              {x.name}{x.key && <button type="button" onClick={() => removeDoc(x.key)} className="ml-2 text-red-600 underline">remove</button>}
            </p>
          ))}
        </div>
        <button type="button" onClick={() => pick(d.id)} disabled={!!uploading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-gray-200 bg-white text-gray-700 hover:ring-brand-300 disabled:opacity-50">
          {uploading === d.id ? 'Uploading…' : have ? 'Add another' : 'Upload'}
        </button>
      </div>
    );
  };

  const field = (fd: TourSpec['fields'][number]) => {
    const v = draft.extras[fd.id];
    const lbl = <label className={label}>{fd.label} {fd.required && req}</label>;
    if (fd.type === 'checkbox') return (
      <label key={fd.id} className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
        <input type="checkbox" checked={!!v} onChange={e => setExtra(fd.id, e.target.checked)} /> {fd.label}
      </label>
    );
    if (fd.type === 'multi') {
      const list = Array.isArray(v) ? v : [];
      return (
        <div key={fd.id} className="sm:col-span-2">
          {lbl}
          <div className="flex flex-wrap gap-2">
            {fd.options!.map(o => {
              const on = list.includes(o);
              return (
                <button key={o} type="button" onClick={() => setExtra(fd.id, on ? list.filter(x => x !== o) : [...list, o])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium ring-1 ${on ? 'bg-btn text-white ring-btn' : 'bg-white text-gray-700 ring-gray-200'}`}>{o}</button>
              );
            })}
          </div>
        </div>
      );
    }
    if (fd.type === 'select') return (
      <div key={fd.id} className="sm:col-span-2">{lbl}
        <select className={input} value={String(v ?? '')} onChange={e => setExtra(fd.id, e.target.value)}>
          <option value="">Choose…</option>
          {fd.options!.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
    if (fd.type === 'textarea') return (
      <div key={fd.id} className="sm:col-span-2">{lbl}<textarea className={input} rows={3} maxLength={fd.max} value={String(v ?? '')} onChange={e => setExtra(fd.id, e.target.value)} /></div>
    );
    return (
      <div key={fd.id} className={fd.type === 'text' ? 'sm:col-span-2' : ''}>{lbl}
        <input className={input} type={fd.type} min={fd.min} max={fd.type === 'number' ? fd.max : undefined} maxLength={fd.type === 'text' ? fd.max : undefined}
          value={v == null ? '' : String(v)} onChange={e => setExtra(fd.id, fd.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" accept={DOC_ACCEPT} className="hidden" onChange={e => upload(e.target.files?.[0])} />

      {spec.trip && (
        <fieldset className="space-y-3">
          <legend className={legend}>Trip</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={label}>Travelling from (city) {req}</label><input className={input} value={draft.trip.from} maxLength={80} onChange={e => setTrip('from', e.target.value)} /></div>
            <div><label className={label}>Destination {req}</label>
              {spec.fixedDestination
                ? <p className="px-3 py-2.5 text-sm text-gray-700 bg-gray-50 rounded-xl">{spec.fixedDestination}</p>
                : <input className={input} value={draft.trip.destination} maxLength={120} onChange={e => setTrip('destination', e.target.value)} />}
            </div>
            <div><label className={label}>Start date {req}</label><input className={input} type="date" min={today} value={draft.trip.startDate} onChange={e => setTrip('startDate', e.target.value)} /></div>
            <div><label className={label}>Nights {req}</label><input className={input} type="number" min={1} max={120} value={draft.trip.nights} onChange={e => setTrip('nights', e.target.value === '' ? '' : Number(e.target.value))} /></div>
            <div><label className={label}>Flexible by (days)</label><input className={input} type="number" min={0} max={30} value={draft.trip.flexibleDays} onChange={e => setTrip('flexibleDays', e.target.value === '' ? '' : Number(e.target.value))} /></div>
            <div><label className={label}>Budget per person (USD)</label><input className={input} type="number" min={1} value={draft.trip.budgetPerPerson ?? ''} placeholder="Optional" onChange={e => setTrip('budgetPerPerson', e.target.value === '' ? '' : Number(e.target.value))} /></div>
            <div><label className={label}>Hotel</label>
              <select className={input} value={draft.trip.hotel} onChange={e => setTrip('hotel', e.target.value)}><option value="">No preference</option>{options.hotels.map(o => <option key={o}>{o}</option>)}</select>
            </div>
            <div><label className={label}>Rooms</label>
              <select className={input} value={draft.trip.rooms} onChange={e => setTrip('rooms', e.target.value)}><option value="">No preference</option>{options.rooms.map(o => <option key={o}>{o}</option>)}</select>
            </div>
            <div><label className={label}>Meals</label>
              <select className={input} value={draft.trip.meals} onChange={e => setTrip('meals', e.target.value)}><option value="">No preference</option>{options.meals.map(o => <option key={o}>{o}</option>)}</select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 self-end pb-2">
              <input type="checkbox" checked={draft.trip.flights} onChange={e => setTrip('flights', e.target.checked)} /> Include flights
            </label>
          </div>
        </fieldset>
      )}

      {spec.fields.length > 0 && (
        <fieldset className="space-y-3">
          <legend className={legend}>{spec.label} details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{spec.fields.map(field)}</div>
        </fieldset>
      )}

      <fieldset className="space-y-3">
        <legend className={legend}>Your contact details</legend>
        <p className="text-xs text-gray-500">The quote, booking and every update go to this email.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Full name {req}</label><input className={input} value={draft.contact.name} maxLength={80} onChange={e => setContact('name', e.target.value)} autoComplete="name" /></div>
          <div><label className={label}>Email {req}</label><input className={input} type="email" value={draft.contact.email} maxLength={120} onChange={e => setContact('email', e.target.value)} autoComplete="email" /></div>
          <div><label className={label}>Phone with country code {req}</label><input className={input} type="tel" value={draft.contact.phone} maxLength={30} onChange={e => setContact('phone', e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></div>
          <div><label className={label}>Country {req}</label><input className={input} value={draft.contact.country} maxLength={60} onChange={e => setContact('country', e.target.value)} autoComplete="country-name" /></div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <legend className={legend}>{spec.trip ? 'Travellers' : 'Applicants'}</legend>
          <select className="px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg" value={draft.travellers.length} onChange={e => setCount(Number(e.target.value))} aria-label="How many">
            {Array.from({ length: maxTravellers }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-500">Exactly as on the {spec.passport ? 'passport' : 'passport or ID'}.{spec.passport && spec.trip && ' Passports must be valid for 6 months after the trip.'}</p>
        {draft.travellers.map((t, i) => (
          <div key={i} className="rounded-xl ring-1 ring-gray-100 p-3 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase">{spec.trip ? 'Traveller' : 'Applicant'} {i + 1}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={label}>Full name {req}</label><input className={input} value={t.fullName} maxLength={80} onChange={e => setTraveller(i, 'fullName', e.target.value)} /></div>
              <div><label className={label}>Date of birth {req}</label><input className={input} type="date" max={today} value={t.dateOfBirth} onChange={e => setTraveller(i, 'dateOfBirth', e.target.value)} /></div>
              <div><label className={label}>Gender {req}</label>
                <select className={input} value={t.gender} onChange={e => setTraveller(i, 'gender', e.target.value)}><option value="">Choose…</option><option>Male</option><option>Female</option><option>Other</option></select>
              </div>
              <div><label className={label}>Nationality {req}</label><input className={input} value={t.nationality} maxLength={60} onChange={e => setTraveller(i, 'nationality', e.target.value)} /></div>
              <div><label className={label}>Document {req}</label>
                <select className={input} value={t.idType} onChange={e => setTraveller(i, 'idType', e.target.value)} disabled={spec.passport}>
                  <option value="">Choose…</option><option>Passport</option>{!spec.passport && <option>National ID</option>}
                </select>
              </div>
              <div><label className={label}>{t.idType === 'National ID' ? 'ID' : 'Passport'} number {req}</label><input className={input} value={t.idNumber} maxLength={30} onChange={e => setTraveller(i, 'idNumber', e.target.value)} /></div>
              <div><label className={label}>Expiry date {t.idType === 'Passport' && spec.trip && req}</label><input className={input} type="date" min={today} value={t.idExpiry} onChange={e => setTraveller(i, 'idExpiry', e.target.value)} /></div>
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className={legend}>Documents</legend>
        <p className="text-xs text-gray-500">PDF, Word or photos, up to 10 MB each. One file can hold every traveller&apos;s copy, or upload one per traveller. They are kept private and used only for this booking.</p>
        {uploadError && <p className="text-sm text-red-700">{uploadError}</p>}
        <div className="divide-y divide-gray-100">
          {spec.requiredDocs.map(d => docRow(d, true))}
          <details className="pt-1">
            <summary className="cursor-pointer text-xs font-semibold text-brand-600 py-2">Add other documents</summary>
            <div className="divide-y divide-gray-100">{spec.optionalDocs.map(d => docRow(d, false))}</div>
          </details>
        </div>
      </fieldset>

      <div>
        <label className={label}>Medical, dietary or accessibility needs</label>
        <input className={input} value={draft.specialNeeds} maxLength={600} onChange={e => setDraft({ ...draft, specialNeeds: e.target.value })} placeholder="e.g. wheelchair, diabetic meals, elderly travellers" />
      </div>
      <div>
        <label className={label}>Anything else (optional)</label>
        <textarea className={input} rows={2} maxLength={2000} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} />
      </div>
    </div>
  );
}
