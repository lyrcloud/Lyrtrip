'use client';

import type { FreightCargo, FreightContact, FreightDraft, FreightOptions } from '@/lib/freight';

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const req = <span className="text-red-500">*</span>;

// Everything a carrier or forwarder needs to price a shipment: route, ready date, cargo, containers, customs
export default function FreightForm({ draft, setDraft, opts }: { draft: FreightDraft; setDraft: (d: FreightDraft) => void; opts: FreightOptions }) {
  const set = <K extends keyof FreightDraft>(k: K, v: FreightDraft[K]) => setDraft({ ...draft, [k]: v });
  const setCargo = (k: keyof FreightCargo, v: string) => set('cargo', { ...draft.cargo, [k]: v });
  const setContact = (k: keyof FreightContact, v: string) => set('contact', { ...draft.contact, [k]: v });
  const spec = opts.modes[draft.mode];
  const intl = spec.international;
  const today = new Date().toISOString().slice(0, 10);
  const weightOptional = ['moving', 'carrier', 'vehicle', 'fcl'].includes(draft.category);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Shipment type">
        {Object.entries(spec.categories).map(([id, name]) => (
          <button key={id} type="button" role="radio" aria-checked={draft.category === id} onClick={() => set('category', id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${draft.category === id ? 'bg-btn text-white shadow-sm' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand-300'}`}>
            {name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={label}>{intl ? 'Collect from' : 'Pickup'} {req}</label>
          <input className={input} value={draft.from} maxLength={200} onChange={e => set('from', e.target.value)} placeholder={intl ? 'Address, city or port (e.g. Shanghai port, China)' : 'Address and city'} /></div>
        <div><label className={label}>{intl ? 'Deliver to' : 'Drop-off'} {req}</label>
          <input className={input} value={draft.to} maxLength={200} onChange={e => set('to', e.target.value)} placeholder={intl ? 'Address, city or port (e.g. Jebel Ali, Dubai)' : 'Address and city'} /></div>
        <div><label className={label}>Cargo ready on {req}</label><input className={input} type="date" min={today} value={draft.readyDate} onChange={e => set('readyDate', e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:pt-5">
          <input type="checkbox" checked={draft.flexibleDates} onChange={e => set('flexibleDates', e.target.checked)} /> Flexible by a few days (often cheaper)
        </label>
      </div>

      <fieldset className="space-y-3 rounded-xl ring-1 ring-gray-100 p-3">
        <legend className="px-1 text-sm font-bold text-gray-900">Cargo</legend>
        <div><label className={label}>What are you shipping? {req}</label>
          <input className={input} value={draft.cargo.description} maxLength={500} onChange={e => setCargo('description', e.target.value)}
            placeholder={draft.category === 'moving' ? 'e.g. 2-bedroom flat, 3rd floor, no lift' : 'e.g. 12 pallets of ceramic tiles'} /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2"><label className={label}>Cargo type</label>
            <select className={input} value={draft.cargo.type} onChange={e => setCargo('type', e.target.value)}>
              {opts.cargoTypes.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div><label className={label}>Total weight (kg) {!weightOptional && req}</label><input className={input} type="number" min={0} value={draft.cargo.weightKg} onChange={e => setCargo('weightKg', e.target.value)} /></div>
          <div><label className={label}>Volume (m³)</label><input className={input} type="number" min={0} step="0.1" value={draft.cargo.volumeCbm} onChange={e => setCargo('volumeCbm', e.target.value)} /></div>
          <div><label className={label}>Pieces</label><input className={input} type="number" min={0} value={draft.cargo.pieces} onChange={e => setCargo('pieces', e.target.value)} /></div>
          <div><label className={label}>Packed as</label>
            <select className={input} value={draft.cargo.packaging} onChange={e => setCargo('packaging', e.target.value)}>
              {opts.packaging.map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div className="col-span-2"><label className={label}>Largest piece (L × W × H cm)</label><input className={input} value={draft.cargo.dimensions} maxLength={200} onChange={e => setCargo('dimensions', e.target.value)} placeholder="e.g. 120 × 100 × 150" /></div>
          <div><label className={label}>Cargo value (USD)</label><input className={input} type="number" min={0} value={draft.cargo.value} onChange={e => setCargo('value', e.target.value)} placeholder="For insurance" /></div>
          {draft.cargo.type === 'Hazardous (dangerous goods)' && (
            <div className="col-span-2 sm:col-span-3"><label className={label}>UN number and class {req}</label><input className={input} value={draft.cargo.unNumber} maxLength={40} onChange={e => setCargo('unNumber', e.target.value)} placeholder="e.g. UN1263, class 3" /></div>
          )}
        </div>
        {draft.category === 'fcl' && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Container type {req}</label>
              <select className={input} value={draft.containers.type} onChange={e => set('containers', { ...draft.containers, type: e.target.value })}>
                <option value="">Choose…</option>
                {opts.containers.map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div><label className={label}>How many {req}</label><input className={input} type="number" min={1} max={500} value={draft.containers.count} onChange={e => set('containers', { ...draft.containers, count: e.target.value })} /></div>
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 text-sm text-gray-700">
        {intl && (
          <div className="w-40"><label className={label}>Incoterm</label>
            <select className={input} value={draft.incoterm || opts.incoterms[0]} onChange={e => set('incoterm', e.target.value)}>
              {opts.incoterms.map(c => <option key={c}>{c}</option>)}
            </select></div>
        )}
        {intl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.customs} onChange={e => set('customs', e.target.checked)} /> Customs clearance needed</label>}
        {!intl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.loadingHelp} onChange={e => set('loadingHelp', e.target.checked)} /> Loading / unloading help</label>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.insurance} onChange={e => set('insurance', e.target.checked)} /> Cargo insurance</label>
        <div className="w-40"><label className={label}>Budget (USD)</label><input className={input} type="number" min={1} value={draft.budget} onChange={e => set('budget', e.target.value)} placeholder="Optional" /></div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-gray-900">Your details</legend>
        <p className="text-xs text-gray-500">The quote and all updates go to this email.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Full name {req}</label><input className={input} value={draft.contact.name} maxLength={80} onChange={e => setContact('name', e.target.value)} autoComplete="name" /></div>
          <div><label className={label}>Company</label><input className={input} value={draft.contact.company} maxLength={120} onChange={e => setContact('company', e.target.value)} autoComplete="organization" placeholder="Optional" /></div>
          <div><label className={label}>Email {req}</label><input className={input} type="email" value={draft.contact.email} maxLength={120} onChange={e => setContact('email', e.target.value)} autoComplete="email" /></div>
          <div><label className={label}>Phone with country code {req}</label><input className={input} type="tel" value={draft.contact.phone} maxLength={30} onChange={e => setContact('phone', e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></div>
          <div><label className={label}>Country {req}</label><input className={input} value={draft.contact.country} maxLength={60} onChange={e => setContact('country', e.target.value)} autoComplete="country-name" /></div>
        </div>
      </fieldset>

      <div>
        <label className={label}>Anything else (optional)</label>
        <textarea className={input} rows={2} maxLength={2000} value={draft.note} onChange={e => set('note', e.target.value)} placeholder="e.g. forklift on site, tail-lift needed, delivery window" />
      </div>
    </div>
  );
}
