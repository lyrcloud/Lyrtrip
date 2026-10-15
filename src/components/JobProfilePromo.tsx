'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { jobsCall, type TalentCard } from '@/lib/jobs';

// Job tab: invite job seekers to get listed, and feature Premium profiles for companies
export default function JobProfilePromo() {
  const [featured, setFeatured] = useState<TalentCard[]>([]);
  useEffect(() => {
    jobsCall<{ talent: TalentCard[] }>({ action: 'talent.list', featured: true })
      .then(d => setFeatured(d.talent.slice(0, 4))).catch(() => setFeatured([]));
  }, []);

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-brand-50 to-amber-50 ring-1 ring-brand-100 p-5 flex flex-wrap items-center gap-4">
        <span className="text-4xl" aria-hidden>🧑‍💼</span>
        <div className="flex-1 min-w-[220px]">
          <p className="font-bold text-gray-900">Get hired: let companies find you</p>
          <p className="text-sm text-gray-600">Create a job profile with your photo and CV. Lyrtrip shows it to companies that are hiring. Plans from $5 a month, weekly to yearly.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/jobs/profile" className="px-4 py-2 rounded-xl bg-btn text-white text-sm font-semibold hover:bg-btn-hover">Create my profile</Link>
          <Link href="/talent" className="px-4 py-2 rounded-xl bg-white ring-1 ring-gray-200 text-sm font-semibold text-gray-700 hover:ring-brand-300">Hiring? Browse talent</Link>
        </div>
      </div>
      {featured.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Featured talent</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {featured.map(c => (
              <Link key={c.id} href={`/talent?id=${c.id}`} className="flex items-center gap-3 rounded-xl bg-white ring-1 ring-amber-200 p-3 hover:shadow-md transition">
                {c.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.photoUrl} alt={c.name} className="w-11 h-11 rounded-full object-cover shrink-0" />
                  : <span className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center shrink-0">🧑</span>}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.headline}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
