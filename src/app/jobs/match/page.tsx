'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import JobApplyDialog from '@/components/JobApplyDialog';
import { jobsCall } from '@/lib/jobs';

interface MatchJob { name: string; jobLocation: string; salary: string | null; jobType: string | null; description: string; expired: boolean }

// A job from a weekly match email: its details and the Apply through Lyrtrip button
export default function JobMatchPage() {
  const [token, setToken] = useState('');
  const [job, setJob] = useState<MatchJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    // Read the link's token directly: useSearchParams would need a Suspense boundary in the static export
    (async () => {
      const t = new URLSearchParams(window.location.search).get('t') ?? '';
      setToken(t);
      if (!t) { setError('This job link is missing its details. Please search jobs on Lyrtrip.'); return; }
      try {
        setJob((await jobsCall<{ job: MatchJob }>({ action: 'job.view', token: t })).job);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this job');
      }
    })();
  }, []);

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 sm:p-6 space-y-4">
        {error && (<>
          <p className="text-gray-700">{error}</p>
          <Link href="/" className="text-brand-600 font-semibold">Search jobs →</Link>
        </>)}
        {!error && !job && <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>}
        {job && (<>
          <div>
            <p className="text-xs font-semibold uppercase text-brand-600">Job match from Lyrtrip</p>
            <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
            <p className="text-gray-600">{[job.jobLocation, job.jobType, job.salary].filter(Boolean).join(' · ')}</p>
          </div>
          {job.expired ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This listing is over 30 days old and may be filled. <Link href="/" className="font-semibold underline">Search for new jobs</Link></p>
          ) : (
            <button onClick={() => setApplying(true)} className="px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover transition">Apply through Lyrtrip</button>
          )}
          {job.description && <p className="text-sm text-gray-700 whitespace-pre-line">{job.description}</p>}
          <p className="text-xs text-gray-500">Lyrtrip sends your profile and CV to the employer and emails you their reply. <Link href="/jobs/profile" className="text-brand-600">My job profile</Link></p>
        </>)}
      </div>
      {applying && job && <JobApplyDialog job={{ name: job.name, jobLocation: job.jobLocation, applyToken: token }} onClose={() => setApplying(false)} />}
    </div>
  );
}
