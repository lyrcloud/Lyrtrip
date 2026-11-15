'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import StudyApplyDialog from '@/components/StudyApplyDialog';
import { studyCall } from '@/lib/study';

interface MatchItem { name: string; placeType: string | null; address: string; category: string; description: string; expired: boolean }

// An admission or scholarship from a weekly match email: its details and the Apply through Lyrtrip button
export default function StudyMatchPage() {
  const [token, setToken] = useState('');
  const [type, setType] = useState<'admission' | 'scholarship'>('admission');
  const [item, setItem] = useState<MatchItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      const qs = new URLSearchParams(window.location.search);
      const t = qs.get('t') ?? '';
      setToken(t);
      setType(qs.get('type') === 'scholarship' ? 'scholarship' : 'admission');
      if (!t) { setError('This link is missing its details. Please search the Study tab on Lyrtrip.'); return; }
      try {
        setItem((await studyCall<{ item: MatchItem }>({ action: 'item.view', token: t })).item);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load this listing');
      }
    })();
  }, []);

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 sm:p-6 space-y-4">
        {error && (<>
          <p className="text-gray-700">{error}</p>
          <Link href="/" className="text-brand-600 font-semibold">Search schools and scholarships →</Link>
        </>)}
        {!error && !item && <div className="py-8 flex justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>}
        {item && (<>
          <div>
            <p className="text-xs font-semibold uppercase text-brand-600">{type === 'scholarship' ? 'Scholarship' : 'Admission'} match from Lyrtrip</p>
            <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
            <p className="text-gray-600">{[item.placeType, item.address].filter(Boolean).join(' · ')}</p>
          </div>
          {item.expired ? (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">This listing is over 30 days old. <Link href="/" className="font-semibold underline">Search the Study tab again</Link></p>
          ) : (
            <button onClick={() => setApplying(true)} className="px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover transition">
              {type === 'scholarship' ? 'Apply for the scholarship through Lyrtrip' : 'Apply through Lyrtrip'}
            </button>
          )}
          {item.description && <p className="text-sm text-gray-700 whitespace-pre-line">{item.description}</p>}
          <p className="text-xs text-gray-500">Lyrtrip prepares your application, tells you the institution&apos;s fee and sends it for you. <Link href="/study/profile" className="text-brand-600">My student profile</Link></p>
        </>)}
      </div>
      {applying && item && <StudyApplyDialog item={{ name: item.name, placeType: item.placeType, address: item.address, applyToken: token, type }} onClose={() => setApplying(false)} />}
    </div>
  );
}
