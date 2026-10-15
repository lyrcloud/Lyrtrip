'use client';

import type { LegalContact, LegalDraft, LegalOptions } from '@/lib/legal';

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const req = <span className="text-red-500">*</span>;

// What a professional needs to quote: the matter, the country whose law or tax applies, deadline and how to meet
export default function LegalForm({ draft, setDraft, opts }: { draft: LegalDraft; setDraft: (d: LegalDraft) => void; opts: LegalOptions }) {
  const set = <K extends keyof LegalDraft>(k: K, v: LegalDraft[K]) => setDraft({ ...draft, [k]: v });
  const setContact = (k: keyof LegalContact, v: string) => set('contact', { ...draft.contact, [k]: v });
  const spec = opts.services[draft.service];
  const today = new Date().toISOString().slice(0, 10);
  const lawyer = draft.service === 'lawyer';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What you need">
        {Object.entries(spec.categories).map(([id, name]) => (
          <button key={id} type="button" role="radio" aria-checked={draft.category === id} onClick={() => set('category', id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${draft.category === id ? 'bg-btn text-white shadow-sm' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand-300'}`}>
            {name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div><label className={label}>Country whose {draft.service === 'tax' ? 'tax' : 'law'} applies {req}</label>
          <input className={input} value={draft.jurisdiction} maxLength={80} onChange={e => set('jurisdiction', e.target.value)} placeholder="e.g. India, United States, UAE" /></div>
        <div><label className={label}>State / city</label>
          <input className={input} value={draft.region} maxLength={80} onChange={e => set('region', e.target.value)} placeholder="e.g. Maharashtra, New York" /></div>
        {draft.service === 'tax'
          ? <div><label className={label}>Tax year</label><input className={input} value={draft.taxYear} maxLength={20} onChange={e => set('taxYear', e.target.value)} placeholder="e.g. 2025-26" /></div>
          : <div><label className={label}>Deadline or court date</label><input className={input} type="date" min={today} value={draft.deadline} onChange={e => set('deadline', e.target.value)} /></div>}
      </div>

      <div><label className={label}>Describe your matter {req}</label>
        <textarea className={input} rows={5} maxLength={3000} value={draft.description} onChange={e => set('description', e.target.value)}
          placeholder={draft.service === 'tax' ? 'e.g. Salaried in Dubai, rental income in India, need to file my Indian return and claim the treaty benefit'
            : lawyer ? 'What happened, what you want to achieve, and any dates or notices you have received' : 'What document or registration you need, and for what purpose'} />
        <p className="mt-1 text-xs text-gray-500">Don&apos;t include passwords or full ID numbers. The professional will ask for documents securely once assigned.</p></div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label className={label}>How to meet</label>
          <select className={input} value={draft.meeting || opts.meeting[0]} onChange={e => set('meeting', e.target.value)}>
            {opts.meeting.map(m => <option key={m}>{m}</option>)}
          </select></div>
        <div><label className={label}>How soon</label>
          <select className={input} value={draft.urgency || opts.urgency[2]} onChange={e => set('urgency', e.target.value)}>
            {opts.urgency.map(m => <option key={m}>{m}</option>)}
          </select></div>
        <div><label className={label}>Language</label><input className={input} value={draft.language} maxLength={40} onChange={e => set('language', e.target.value)} placeholder="English" /></div>
        <div><label className={label}>Budget (USD)</label><input className={input} type="number" min={1} value={draft.budget} onChange={e => set('budget', e.target.value)} placeholder="Optional" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={draft.forBusiness} onChange={e => set('forBusiness', e.target.checked)} /> This is for a business</label>
          {draft.forBusiness && <input className={input} value={draft.businessName} maxLength={120} onChange={e => set('businessName', e.target.value)} placeholder="Business name" />}
        </div>
        {lawyer && <div><label className={label}>Other party (for a conflict check)</label>
          <input className={input} value={draft.otherParty} maxLength={120} onChange={e => set('otherParty', e.target.value)} placeholder="Person or company on the other side, if any" /></div>}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-gray-900">Your details</legend>
        <p className="text-xs text-gray-500">The fee quote and all updates go to this email.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Full name {req}</label><input className={input} value={draft.contact.name} maxLength={80} onChange={e => setContact('name', e.target.value)} autoComplete="name" /></div>
          <div><label className={label}>Email {req}</label><input className={input} type="email" value={draft.contact.email} maxLength={120} onChange={e => setContact('email', e.target.value)} autoComplete="email" /></div>
          <div><label className={label}>Phone with country code {req}</label><input className={input} type="tel" value={draft.contact.phone} maxLength={30} onChange={e => setContact('phone', e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></div>
          <div><label className={label}>Country you live in {req}</label><input className={input} value={draft.contact.country} maxLength={60} onChange={e => setContact('country', e.target.value)} autoComplete="country-name" /></div>
        </div>
      </fieldset>
    </div>
  );
}
