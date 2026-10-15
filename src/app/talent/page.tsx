'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { jobsCall, PLAN_STYLE, type TalentCard, type TalentProfile } from '@/lib/jobs';
import { rememberReturnTo } from '@/lib/returnTo';

const input = 'w-full px-4 py-3 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const monthYear = (m: string) => (m ? new Date(`${m}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');

function Avatar({ url, name, size }: { url: string | null; name: string; size: string }) {
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt={name} className={`${size} rounded-full object-cover bg-gray-100`} />
    : <span className={`${size} rounded-full bg-gray-100 flex items-center justify-center text-2xl`}>🧑</span>;
}

// One candidate, as a company (or the owner) sees it
function ProfileView({ id, onClose }: { id: string; onClose: () => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<{ profile: TalentProfile; viewerIsCompany: boolean; own: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    jobsCall<{ profile: TalentProfile; viewerIsCompany: boolean; own: boolean }>({ action: 'talent.get', id })
      .then(setData).catch(err => setError(err.message));
  }, [id, user]);

  const p = data?.profile;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {!p && <div className="p-10 text-center text-sm text-gray-500">{error ?? 'Loading…'}</div>}
        {p && (<>
          <div className="p-6 sm:p-8 border-b border-gray-100 flex gap-4 items-start">
            <Avatar url={p.photoUrl} name={p.name} size="w-20 h-20 sm:w-24 sm:h-24 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{p.name}</h2>
                {p.openToWork && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Open to work</span>}
              </div>
              <p className="text-gray-700">{p.headline}</p>
              <p className="text-sm text-gray-500">{[p.city, p.country].filter(Boolean).join(', ')}{p.yearsExperience != null ? ` · ${p.yearsExperience} yr${p.yearsExperience === 1 ? '' : 's'} experience` : ''}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-gray-400 hover:text-gray-700">×</button>
          </div>

          <div className="p-6 sm:p-8 space-y-6 text-sm">
            {p.contact ? (
              <div className="rounded-xl bg-brand-50 p-4 flex flex-wrap gap-x-6 gap-y-2 items-center">
                <a href={`mailto:${p.contact.email}`} className="font-semibold text-brand-700">✉️ {p.contact.email}</a>
                <a href={`tel:${p.contact.phone}`} className="font-semibold text-brand-700">📞 {p.contact.phone}</a>
                {p.contact.cvUrl && <a href={p.contact.cvUrl} className="font-semibold text-brand-700">📄 Download CV</a>}
                {p.contact.expectedSalary && <span className="text-gray-700">Expects {p.contact.expectedSalary}</span>}
              </div>
            ) : (
              <div className="rounded-xl bg-gray-50 p-4 text-gray-700">
                Hiring? Contact details and CVs are for companies with an approved Lyrtrip business account.{' '}
                {user
                  ? <Link href="/rewards" className="font-semibold text-brand-600">Apply for a business account →</Link>
                  : <Link href="/login" onClick={() => rememberReturnTo(`/talent?id=${id}`)} className="font-semibold text-brand-600">Sign in →</Link>}
              </div>
            )}

            <section><h3 className="font-bold text-gray-900 mb-1">About</h3><p className="text-gray-700 whitespace-pre-line">{p.about}</p></section>

            <section className="grid sm:grid-cols-2 gap-4">
              <div><h3 className="font-bold text-gray-900 mb-1">Looking for</h3>
                <p className="text-gray-700">{p.desiredRoles.join(', ')}</p>
                <p className="text-gray-500">{[...p.jobTypes, ...p.workModes].join(' · ')}</p></div>
              <div><h3 className="font-bold text-gray-900 mb-1">Availability</h3>
                <p className="text-gray-700">{p.availability}{p.willingToRelocate ? ' · Willing to relocate' : ''}</p>
                {p.workAuthorization && <p className="text-gray-500">{p.workAuthorization}</p>}</div>
            </section>

            {p.experience.length > 0 && (
              <section><h3 className="font-bold text-gray-900 mb-2">Experience</h3>
                <ul className="space-y-3">{p.experience.map((e, i) => (
                  <li key={i} className="border-l-2 border-brand-200 pl-3">
                    <p className="font-semibold text-gray-900">{e.title} · {e.company}</p>
                    <p className="text-gray-500">{[monthYear(e.start), e.current ? 'Present' : monthYear(e.end)].filter(Boolean).join(' – ')}{e.location ? ` · ${e.location}` : ''}</p>
                    {e.description && <p className="text-gray-700 whitespace-pre-line mt-1">{e.description}</p>}
                  </li>
                ))}</ul></section>
            )}
            {p.firstJob && p.experience.length === 0 && <p className="text-gray-600">Looking for a first job.</p>}

            <section><h3 className="font-bold text-gray-900 mb-2">Education</h3>
              <ul className="space-y-2">{p.education.map((e, i) => (
                <li key={i}><p className="font-semibold text-gray-900">{e.school}</p>
                  <p className="text-gray-500">{[e.degree, e.field].filter(Boolean).join(', ')}{e.start || e.end ? ` · ${[e.start, e.end].filter(Boolean).join(' – ')}` : ''}</p></li>
              ))}</ul></section>

            <section><h3 className="font-bold text-gray-900 mb-2">Skills</h3>
              <div className="flex flex-wrap gap-1.5">{p.skills.map(s => <span key={s} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{s}</span>)}</div></section>
            <section><h3 className="font-bold text-gray-900 mb-1">Languages</h3><p className="text-gray-700">{p.languages.join(', ')}</p></section>

            {Object.values(p.links).some(Boolean) && (
              <section className="flex flex-wrap gap-4">
                {p.links.linkedin && <a href={p.links.linkedin} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand-600">LinkedIn</a>}
                {p.links.portfolio && <a href={p.links.portfolio} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand-600">Portfolio</a>}
                {p.links.github && <a href={p.links.github} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-brand-600">GitHub</a>}
              </section>
            )}
            {data?.own && <p className="text-xs text-gray-400">This is your profile. <Link href="/jobs/profile" className="underline">Edit it</Link>.</p>}
          </div>
        </>)}
      </div>
    </div>
  );
}

export default function TalentPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [where, setWhere] = useState('');
  const [rows, setRows] = useState<TalentCard[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [isCompany, setIsCompany] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setError(null);
    try {
      const data = await jobsCall<{ talent: TalentCard[]; more: boolean; viewerIsCompany: boolean }>({ action: 'talent.list', q, location: where, page: nextPage });
      setRows(r => (nextPage === 0 ? data.talent : [...(r ?? []), ...data.talent]));
      setMore(data.more);
      setPage(nextPage);
      setIsCompany(data.viewerIsCompany);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profiles.');
      setRows(r => r ?? []);
    }
  }, [q, where]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setOpen(id);
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const close = () => { setOpen(null); window.history.replaceState({}, '', '/talent'); };

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Lyrtrip talent</h1>
            <p className="text-gray-600 text-sm">People open to work in travel, hospitality and beyond.{isCompany ? ' You can see contact details and CVs.' : ''}</p>
          </div>
          <Link href="/jobs/profile" className="px-4 py-2 rounded-xl bg-btn text-white text-sm font-semibold hover:bg-btn-hover">Get listed from $5/month</Link>
        </div>

        <form onSubmit={e => { e.preventDefault(); void load(0); }} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mb-6">
          <input className={input} value={q} onChange={e => setQ(e.target.value)} placeholder="Role, skill or name" />
          <input className={input} value={where} onChange={e => setWhere(e.target.value)} placeholder="City, country or Remote" />
          <button className="px-6 py-3 rounded-xl bg-btn text-white font-semibold hover:bg-btn-hover">Search</button>
        </form>

        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
        {rows === null && <p className="text-sm text-gray-500">Loading…</p>}
        {rows?.length === 0 && <p className="text-sm text-gray-500 bg-white rounded-2xl p-8 text-center">No profiles match yet. Try another search.</p>}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows?.map(c => (
            <button key={c.id} onClick={() => { setOpen(c.id); window.history.replaceState({}, '', `/talent?id=${c.id}`); }}
              className={`text-left bg-white rounded-2xl p-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 ${c.plan === 'premium' ? 'ring-2 ring-amber-300' : c.plan === 'plus' ? 'ring-2 ring-sky-200' : 'ring-1 ring-gray-100'}`}>
              <div className="flex gap-3 items-center">
                <Avatar url={c.photoUrl} name={c.name} size="w-14 h-14 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{c.name}</p>
                  <p className="text-sm text-gray-600 line-clamp-2">{c.headline}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">{[c.city, c.country].filter(Boolean).join(', ')} · {c.workModes.join(', ')}</p>
              <div className="flex flex-wrap gap-1 mt-2">{c.skills.slice(0, 5).map(s => <span key={s} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">{s}</span>)}</div>
              <div className="flex gap-2 mt-3">
                {c.featured && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PLAN_STYLE.premium}`}>Featured</span>}
                {c.openToWork && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Open to work</span>}
              </div>
            </button>
          ))}
        </div>
        {more && <div className="text-center mt-6"><button onClick={() => load(page + 1)} className="px-5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-700">Show more</button></div>}
      </div>
      {open && <ProfileView id={open} onClose={close} />}
    </div>
  );
}
