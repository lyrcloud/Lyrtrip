'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { studyCall, STUDY_STATUS_STYLE, type StudyApplication, type StudyApplyCheck } from '@/lib/study';
import { rememberReturnTo } from '@/lib/returnTo';

export interface ApplyStudy { name: string; placeType?: string | null; address?: string | null; applyToken: string; type: 'admission' | 'scholarship' }

const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';
const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

// Applying through Lyrtrip: the student's profile and documents go to Lyrtrip, which applies for them
export default function StudyApplyDialog({ item, onClose }: { item: ApplyStudy; onClose: () => void }) {
  const { user, loading } = useAuth();
  const [type, setType] = useState(item.type);
  const [check, setCheck] = useState<StudyApplyCheck | null>(null);
  const [program, setProgram] = useState('');
  const [intake, setIntake] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<StudyApplication | null>(null);

  useEffect(() => {
    if (!user) return;
    studyCall<StudyApplyCheck>({ action: 'apply.check', token: item.applyToken, type })
      .then(c => { setCheck(c); setIntake(i => i || c.intake); setProgram(pr => pr || c.fieldsOfStudy[0] || ''); })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load your profile.'));
  }, [user, item.applyToken, type]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await studyCall<{ application: StudyApplication }>({ action: 'apply', token: item.applyToken, type, program, intake, note });
      setDone(r.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The application failed. Please try again.');
    }
    setBusy(false);
  };

  const pct = Math.round((check?.serviceRate ?? 0.1) * 100);
  let body: React.ReactNode;
  if (!loading && !user) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Sign in to apply. Lyrtrip prepares and sends your application for you.</p>
        <Link href="/login" onClick={() => rememberReturnTo('/')} className={`${primary} inline-block`}>Sign in to apply</Link>
      </div>
    );
  } else if (done) {
    body = (
      <div className="space-y-3">
        <p><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STUDY_STATUS_STYLE[done.status] ?? ''}`}>{done.statusLabel}</span></p>
        <p className="text-sm text-gray-700">
          Lyrtrip checks your documents and finds the institution&apos;s {type} fee. We email you the amount to pay (the fee plus our {pct}% service charge), then apply for you.
        </p>
        <Link href="/study/profile#applications" className="text-sm font-semibold text-brand-600">See my applications →</Link>
      </div>
    );
  } else if (!check) {
    body = error ? null : <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>;
  } else if (check.missing.length) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">To apply for {type === 'scholarship' ? 'a scholarship' : 'admission'}, add these to your student profile:</p>
        <ul className="list-disc pl-5 text-sm text-gray-700 max-h-48 overflow-y-auto">{check.missing.map(m => <li key={m}>{m}</li>)}</ul>
        <Link href="/study/profile" className={`${primary} inline-block`}>Complete my student profile</Link>
      </div>
    );
  } else if (!check.live) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">Your profile is ready. Choose a study plan to apply through Lyrtrip: from $5 a month, weekly to yearly.
          The institution&apos;s own fee, plus our {pct}% service charge, is paid per application.</p>
        <Link href="/study/profile#plans" className={`${primary} inline-block`}>Choose a plan</Link>
      </div>
    );
  } else if (check.appsUsed >= check.appsLimit) {
    body = <p className="text-sm text-gray-700">You have used all {check.appsLimit} applications in this billing period. More become available when your plan renews.</p>;
  } else {
    body = (
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 ring-1 ring-gray-100 p-3 text-sm">
          <p className="font-semibold text-gray-900">{check.name}</p>
          <p className="text-gray-600">{check.studyLevel} · {check.email}</p>
          <p className="text-xs text-gray-500 mt-1">{check.appsLimit - check.appsUsed} of {check.appsLimit} applications left this period · all your documents are attached</p>
          <Link href="/study/profile" className="text-xs text-brand-600 font-semibold">Edit my profile</Link>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{type === 'scholarship' ? 'Scholarship or program it is for' : 'Program or course'} <span className="text-red-500">*</span></label>
          <input className={input} value={program} onChange={e => setProgram(e.target.value)} maxLength={120} placeholder={type === 'scholarship' ? "e.g. Master's in Computer Science" : 'e.g. BSc Nursing'} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Intake</label>
          <input className={input} type="month" value={intake} onChange={e => setIntake(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Anything we should know (optional)</label>
          <textarea className={input} rows={3} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. second choice program, deadline you know of" />
        </div>
        <p className="text-xs text-gray-500">Lyrtrip applies to the institution for you. Before we apply, we email you the {type} fee to pay: the institution&apos;s fee plus our {pct}% service charge. Replies come to you through Lyrtrip.</p>
        <button onClick={submit} disabled={busy || program.trim().length < 2} className={`${primary} w-full`}>{busy ? 'Sending…' : 'Send application'}</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Apply to ${item.name}`}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Apply via Lyrtrip</p>
            <h2 className="text-lg font-bold text-gray-900">{item.name}</h2>
            <p className="text-sm text-gray-600">{[item.placeType, item.address].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        {!done && (
          <div className="mb-4 flex gap-2">
            {(['admission', 'scholarship'] as const).map(t => (
              <button key={t} type="button" onClick={() => { if (t !== type) setCheck(null); setType(t); setError(null); }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium ring-1 ${type === t ? 'bg-btn text-white ring-btn' : 'bg-white text-gray-700 ring-gray-200'}`}>
                {t === 'admission' ? 'Admission' : 'Scholarship'}
              </button>
            ))}
          </div>
        )}
        {error && <div className="mb-3 rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
        {body}
      </div>
    </div>
  );
}
