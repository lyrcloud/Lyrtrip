'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { jobsCall, APP_STYLE, type ApplyCheck, type JobApplication } from '@/lib/jobs';
import { rememberReturnTo } from '@/lib/returnTo';

export interface ApplyJob { name: string; company?: string; jobLocation?: string; applyToken: string }

const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';

// Applying through Lyrtrip: the applicant's job profile and CV go to Lyrtrip, which forwards them to the employer
export default function JobApplyDialog({ job, onClose }: { job: ApplyJob; onClose: () => void }) {
  const { user, loading } = useAuth();
  const [check, setCheck] = useState<ApplyCheck | null>(null);
  const [cover, setCover] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<JobApplication | null>(null);

  useEffect(() => {
    if (!user) return;
    jobsCall<ApplyCheck>({ action: 'apply.check', token: job.applyToken })
      .then(setCheck).catch(err => setError(err instanceof Error ? err.message : 'Could not load your profile.'));
  }, [user, job.applyToken]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await jobsCall<{ application: JobApplication }>({ action: 'apply', token: job.applyToken, coverLetter: cover });
      setDone(r.application);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The application failed. Please try again.');
    }
    setBusy(false);
  };

  const applied = done ?? check?.application ?? null;
  let body: React.ReactNode;
  if (!loading && !user) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Sign in to apply. Lyrtrip sends your job profile and CV to the employer for you.</p>
        <Link href="/login" onClick={() => rememberReturnTo('/')} className={`${primary} inline-block`}>Sign in to apply</Link>
      </div>
    );
  } else if (applied) {
    body = (
      <div className="space-y-3">
        <p className="text-sm">
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${APP_STYLE[applied.status] ?? ''}`}>{applied.statusLabel}</span>
        </p>
        <p className="text-sm text-gray-700">
          {done ? 'Your application has been sent to Lyrtrip. ' : 'You have already applied for this job. '}
          We send it to the employer and email you when they reply. All contact about this job goes through Lyrtrip.
        </p>
        <Link href="/jobs/profile#applications" className="text-sm font-semibold text-brand-600">See my applications →</Link>
      </div>
    );
  } else if (!check) {
    body = error ? null : <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>;
  } else if (check.missing.length) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-gray-700">To apply, add these to your job profile. Creating a profile is free; you only pay if you want companies to find you in the talent directory.</p>
        <ul className="list-disc pl-5 text-sm text-gray-700">{check.missing.map(m => <li key={m}>{m}</li>)}</ul>
        <Link href="/jobs/profile" className={`${primary} inline-block`}>Complete my profile</Link>
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 ring-1 ring-gray-100 p-3 text-sm">
          <p className="font-semibold text-gray-900">{check.name}</p>
          <p className="text-gray-600">{check.headline}</p>
          <p className="text-gray-500 text-xs mt-1">{check.email} · {check.phone} · CV: {check.cvName ?? 'attached'}</p>
          <Link href="/jobs/profile" className="text-xs text-brand-600 font-semibold">Edit my profile</Link>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Cover letter (optional)</label>
          <textarea value={cover} onChange={e => setCover(e.target.value)} rows={6} maxLength={4000}
            placeholder="Why you are a good fit for this role"
            className="w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100" />
        </div>
        <p className="text-xs text-gray-500">Lyrtrip reviews your application and sends your profile and CV to the employer. Their replies come to you through Lyrtrip.</p>
        <button onClick={submit} disabled={busy} className={`${primary} w-full`}>{busy ? 'Sending…' : 'Send application'}</button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Apply for ${job.name}`}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Apply via Lyrtrip</p>
            <h2 className="text-lg font-bold text-gray-900">{job.name}</h2>
            <p className="text-sm text-gray-600">{[job.company, job.jobLocation].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        {error && <div className="mb-3 rounded-lg p-3 text-sm bg-red-50 border border-red-200 text-red-700">{error}</div>}
        {body}
      </div>
    </div>
  );
}
