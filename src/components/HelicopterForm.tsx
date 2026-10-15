'use client';

import { HELI_LOOP_CHARTERS, NEW_PASSENGER, type HeliContact, type HeliDraft, type HeliOptions, type HeliPassenger } from '@/lib/helicopter';

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const req = <span className="text-red-500">*</span>;

// Everything an operator needs to price a charter: route, date, aircraft, and each passenger's ID and weight
export default function HelicopterForm({ draft, setDraft, opts }: { draft: HeliDraft; setDraft: (d: HeliDraft) => void; opts: HeliOptions }) {
  const set = <K extends keyof HeliDraft>(k: K, v: HeliDraft[K]) => setDraft({ ...draft, [k]: v });
  const setContact = (k: keyof HeliContact, v: string) => set('contact', { ...draft.contact, [k]: v });
  const setPassenger = (i: number, k: keyof HeliPassenger, v: string) =>
    set('passengers', draft.passengers.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(opts.maxPassengers, n));
    set('passengers', Array.from({ length: count }, (_, i) => draft.passengers[i] ?? { ...NEW_PASSENGER }));
  };
  const loop = HELI_LOOP_CHARTERS.includes(draft.charter);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Charter type">
        {Object.entries(opts.charters).map(([id, name]) => (
          <button key={id} type="button" role="radio" aria-checked={draft.charter === id} onClick={() => set('charter', id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${draft.charter === id ? 'bg-btn text-white shadow-sm' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand-300'}`}>
            {name.replace(/ \(.*\)$/, '')}
          </button>
        ))}
      </div>
      {draft.charter === 'pilgrimage' && <p className="text-xs text-gray-500">e.g. Kedarnath, Char Dham, Do Dham, Vaishno Devi, Amarnath, Kailash Mansarovar. Seasonal shuttles sell out early: send the request as soon as you know your dates.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={label}>{loop ? 'Take off from' : 'From'} {req}</label>
          <input className={input} value={draft.from} maxLength={160} onChange={e => set('from', e.target.value)} placeholder="Helipad, airport, city or address" /></div>
        <div><label className={label}>{loop ? 'Fly over / route (optional)' : 'To'} {!loop && req}</label>
          <input className={input} value={draft.to} maxLength={160} onChange={e => set('to', e.target.value)} placeholder={loop ? 'e.g. Grand Canyon, Manhattan skyline' : 'Helipad, airport, city or address'} /></div>
      </div>
      {!loop && (
        <div className="inline-grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-semibold" role="radiogroup" aria-label="Trip type">
          {[[false, 'One way'], [true, 'Return']].map(([v, l]) => (
            <button key={String(v)} type="button" role="radio" aria-checked={draft.roundTrip === v} onClick={() => set('roundTrip', v as boolean)}
              className={`rounded-full px-4 py-1.5 ${draft.roundTrip === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>{l as string}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label className={label}>Date {req}</label><input className={input} type="date" min={today} value={draft.date} onChange={e => set('date', e.target.value)} /></div>
        <div><label className={label}>Time</label><input className={input} type="time" value={draft.time} onChange={e => set('time', e.target.value)} /></div>
        {draft.roundTrip && !loop && (<>
          <div><label className={label}>Return date {req}</label><input className={input} type="date" min={draft.date || today} value={draft.returnDate} onChange={e => set('returnDate', e.target.value)} /></div>
          <div><label className={label}>Return time</label><input className={input} type="time" value={draft.returnTime} onChange={e => set('returnTime', e.target.value)} /></div>
        </>)}
        {loop && <div><label className={label}>Flying time (hours) {req}</label><input className={input} type="number" min={0.5} max={12} step={0.5} value={draft.hours} onChange={e => set('hours', e.target.value)} placeholder="1" /></div>}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={draft.flexibleDates} onChange={e => set('flexibleDates', e.target.checked)} /> My dates are flexible (weather or a cheaper slot)
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label className={label}>Passengers {req}</label>
          <select className={input} value={draft.passengers.length} onChange={e => setCount(Number(e.target.value))}>
            {Array.from({ length: opts.maxPassengers }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select></div>
        <div className="col-span-2 sm:col-span-1"><label className={label}>Helicopter</label>
          <select className={input} value={draft.aircraft} onChange={e => set('aircraft', e.target.value)}>
            {opts.aircraft.map(a => <option key={a}>{a}</option>)}
          </select></div>
        <div><label className={label}>Luggage (kg, total)</label><input className={input} type="number" min={0} max={1000} value={draft.luggageKg} onChange={e => set('luggageKg', e.target.value)} placeholder="0" /></div>
        <div><label className={label}>Budget (USD)</label><input className={input} type="number" min={1} value={draft.budget} onChange={e => set('budget', e.target.value)} placeholder="Optional" /></div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-gray-900">Your details</legend>
        <p className="text-xs text-gray-500">The quote and all updates go to this email.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Full name {req}</label><input className={input} value={draft.contact.name} maxLength={80} onChange={e => setContact('name', e.target.value)} autoComplete="name" /></div>
          <div><label className={label}>Email {req}</label><input className={input} type="email" value={draft.contact.email} maxLength={120} onChange={e => setContact('email', e.target.value)} autoComplete="email" /></div>
          <div><label className={label}>Phone with country code {req}</label><input className={input} type="tel" value={draft.contact.phone} maxLength={30} onChange={e => setContact('phone', e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></div>
          <div><label className={label}>Country {req}</label><input className={input} value={draft.contact.country} maxLength={60} onChange={e => setContact('country', e.target.value)} autoComplete="country-name" /></div>
        </div>
      </fieldset>

      {draft.passengers.map((p, i) => (
        <fieldset key={i} className="space-y-3 rounded-xl ring-1 ring-gray-100 p-3">
          <legend className="px-1 text-sm font-bold text-gray-900">Passenger {i + 1}</legend>
          <p className="text-xs text-gray-500">As on the photo ID they will bring. The pilot needs each weight to balance the helicopter safely.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><label className={label}>Full name as on ID {req}</label><input className={input} value={p.fullName} maxLength={80} onChange={e => setPassenger(i, 'fullName', e.target.value)} /></div>
            <div><label className={label}>Weight (kg) {req}</label><input className={input} type="number" min={3} max={250} value={p.weightKg} onChange={e => setPassenger(i, 'weightKg', e.target.value)} /></div>
            <div><label className={label}>Date of birth {req}</label><input className={input} type="date" max={today} value={p.dateOfBirth} onChange={e => setPassenger(i, 'dateOfBirth', e.target.value)} /></div>
            <div><label className={label}>Nationality {req}</label><input className={input} value={p.nationality} maxLength={60} onChange={e => setPassenger(i, 'nationality', e.target.value)} /></div>
            <div>
              <label className={label}>Photo ID {req}</label>
              <select className={input} value={p.idType} onChange={e => setPassenger(i, 'idType', e.target.value)}>
                <option value="">Choose…</option>
                {opts.idTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3"><label className={label}>ID number {req}</label><input className={input} value={p.idNumber} maxLength={30} onChange={e => setPassenger(i, 'idNumber', e.target.value)} /></div>
          </div>
        </fieldset>
      ))}

      <div>
        <label className={label}>Anything else (optional)</label>
        <textarea className={input} rows={2} maxLength={2000} value={draft.note} onChange={e => set('note', e.target.value)} placeholder="e.g. doors-off flight, champagne, wheelchair, pet on board" />
      </div>
    </div>
  );
}
