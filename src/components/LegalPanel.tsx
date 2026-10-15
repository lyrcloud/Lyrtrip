'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import LegalForm from '@/components/LegalForm';
import { legalCall, LEGAL_ICON, LEGAL_STATUS_STYLE, type LegalDraft, type LegalOptions, type LegalRequest, type LegalService } from '@/lib/legal';
import { rememberReturnTo } from '@/lib/returnTo';

const primary = 'px-5 py-3 bg-btn text-white rounded-xl font-bold hover:bg-btn-hover disabled:bg-gray-300 transition';

const INTRO: Record<LegalService, [string, string]> = {
  tax: ['Tax services through Lyrtrip', 'Income tax returns, business and GST/VAT filing, expat and NRI tax, tax planning, notices and audits, bookkeeping and payroll.'],
  legal: ['Legal services through Lyrtrip', 'Company registration, contracts, trademarks, wills and trusts, power of attorney, notary and apostille, property papers and licences.'],
  lawyer: ['Lawyers through Lyrtrip', 'Immigration, family, property, criminal, employment, consumer, injury and business matters, up to court representation.'],
};

// Tax & Legal options: Lyrtrip finds a licensed professional, quotes one fee (plus the service charge),
// assigns them once the customer pays, and posts progress updates.
export default function LegalPanel({ service }: { service: LegalService }) {
  const { user, loading } = useAuth();
  const [opts, setOpts] = useState<LegalOptions | null>(null);
  const [draft, setDraft] = useState<LegalDraft | null>(null);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LegalRequest | null>(null);

  // Loads the form; once signed in, fills in the customer's name and email (kept if already typed)
  useEffect(() => {
    legalCall<LegalOptions>({ action: 'options' })
      .then(o => {
        setOpts(o);
        setDraft(prev => {
          const d: LegalDraft = prev ?? {
            service, category: Object.keys(o.services[service].categories)[0], jurisdiction: '', region: '', description: '', deadline: '', taxYear: '',
            forBusiness: false, businessName: '', meeting: o.meeting[0], urgency: o.urgency[2], language: 'English', otherParty: '',
            contact: { name: '', email: '', phone: '', country: '' }, budget: '',
          };
          if (!user || d.contact.email) return d;
          return { ...d, contact: { ...d.contact, name: d.contact.name || user.name || '', email: user.email ?? '' } };
        });
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load the form.'));
  }, [user, service]);

  const submit = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const r = await legalCall<{ request: LegalRequest }>({ action: 'request', ...draft, acceptTerms: terms });
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
      <div className="rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50 ring-1 ring-slate-200 p-4">
        <p className="font-bold text-gray-900">{LEGAL_ICON[service]} {INTRO[service][0]}</p>
        <p className="text-sm text-gray-600">
          {INTRO[service][1]} Tell us about your matter: we find a licensed professional, send you one all-in fee (plus our {pct}% service charge),
          and assign them once you pay. <Link href="/legal/requests" className="font-semibold text-brand-600">My requests →</Link>
        </p>
      </div>

      {done ? (
        <div className="rounded-2xl ring-1 ring-gray-100 bg-white p-5 space-y-3">
          <p><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${LEGAL_STATUS_STYLE[done.status] ?? ''}`}>{done.statusLabel}</span></p>
          <p className="text-sm text-gray-700">
            Lyrtrip is finding a professional for {done.categoryLabel.toLowerCase()} ({done.jurisdiction}). We will email you the fee: theirs plus our
            {' '}{pct}% service charge. Nothing is charged until you pay that quote.
          </p>
          <div className="flex gap-3">
            <Link href="/legal/requests" className="text-sm font-semibold text-brand-600">See my requests →</Link>
            <button type="button" onClick={() => { setDone(null); setTerms(false); }} className="text-sm font-semibold text-gray-600 underline">Request another</button>
          </div>
        </div>
      ) : !opts || !draft ? (
        error ? <p className="text-sm text-red-700">{error}</p> : <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>
      ) : (
        <>
          <LegalForm draft={draft} setDraft={setDraft} opts={opts} />
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input type="checkbox" className="mt-0.5" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>
              I understand Lyrtrip is not a law or accounting firm and does not give advice: it arranges an independent licensed professional, who
              advises me directly. I pay their quoted fee plus Lyrtrip&apos;s {pct}% service charge; the quote is valid for {opts.quoteHours} hours.
              Government, court and filing fees not in the quote are mine to pay. If no professional can take my matter, I get a full refund.
            </span>
          </label>
          {error && <div role="alert" className="rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
          {!loading && !user ? (
            <Link href="/login" onClick={() => rememberReturnTo(`/?tab=${service}`)} className={`${primary} inline-block`}>Sign in to request a quote</Link>
          ) : (
            <button type="button" onClick={submit} disabled={busy || !terms || loading} className={`${primary} w-full sm:w-auto`}>{busy ? 'Sending…' : 'Get a fee quote'}</button>
          )}
        </>
      )}
    </div>
  );
}
