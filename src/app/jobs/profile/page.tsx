'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import PageLoader from '@/components/PageLoader';
import { jobsCall, uploadJobFile, APP_STYLE, PLAN_STYLE, type Education, type JobApplication, type Experience, type JobPlans, type JobProfile, type OwnerView } from '@/lib/jobs';
import { rememberReturnTo } from '@/lib/returnTo';

const EMPTY: JobProfile = {
  firstName: '', lastName: '', headline: '', city: '', country: '', email: '', phone: '', about: '', desiredRoles: [], jobTypes: [],
  workModes: [], yearsExperience: null, skills: [], languages: [], availability: '', willingToRelocate: false, openToWork: true,
  firstJob: false, workAuthorization: '', expectedSalary: '', links: { linkedin: '', portfolio: '', github: '' }, experience: [], education: [],
};
const NEW_JOB: Experience = { title: '', company: '', location: '', start: '', end: '', current: false, description: '' };
const NEW_SCHOOL: Education = { school: '', degree: '', field: '', start: '', end: '' };

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const card = 'bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 sm:p-6';
const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';
const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium ring-1 transition ${on ? 'bg-btn text-white ring-btn' : 'bg-white text-gray-700 ring-gray-200 hover:ring-brand-300'}`;
const req = <span className="text-red-500">*</span>;
const usd = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;
const PER: Record<string, string> = { week: 'week', month: 'month', month3: '3 months', month6: '6 months', year: '12 months' };

// A comma-separated list edited as text, kept as an array
function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [text, setText] = useState(value.join(', '));
  useEffect(() => { setText(value.join(', ')); }, [value]);
  return (
    <input className={input} value={text} placeholder={placeholder}
      onChange={e => setText(e.target.value)}
      onBlur={() => onChange(text.split(',').map(s => s.trim()).filter(Boolean))} />
  );
}

// Jobs applied for through Lyrtrip, with where each one stands
function MyApplications() {
  const [apps, setApps] = useState<JobApplication[] | null>(null);
  const load = () => jobsCall<{ applications: JobApplication[] }>({ action: 'applications.mine' }).then(d => setApps(d.applications)).catch(() => setApps([]));
  useEffect(() => { load(); }, []);
  const withdraw = async (a: JobApplication) => {
    if (!confirm(`Withdraw your application for ${a.title}?`)) return;
    await jobsCall({ action: 'application.withdraw', id: a.id }).catch(err => alert(err instanceof Error ? err.message : 'Could not withdraw'));
    load();
  };
  return (
    <div id="applications" className={card}>
      <h2 className="font-bold text-gray-900">My applications</h2>
      <p className="text-sm text-gray-600 mb-3">Apply from the Job tab and Lyrtrip sends your profile and CV to the employer. Replies come to you through Lyrtrip.</p>
      {apps === null && <p className="text-sm text-gray-500">Loading…</p>}
      {apps?.length === 0 && <p className="text-sm text-gray-500">No applications yet. <Link href="/" className="text-brand-600 font-semibold">Search jobs</Link></p>}
      <div className="divide-y divide-gray-100">
        {apps?.map(a => (
          <div key={a.id} className="py-3 flex flex-wrap items-start justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">{a.title}</p>
              <p className="text-gray-600">{a.location}</p>
              <p className="text-xs text-gray-400">Applied {new Date(a.createdAt).toLocaleDateString()}</p>
              {a.message && <p className="mt-1 text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-2">{a.message}</p>}
            </div>
            <div className="text-right space-y-1">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${APP_STYLE[a.status] ?? ''}`}>{a.statusLabel}</span>
              {['submitted', 'forwarded', 'interview'].includes(a.status) && (
                <button onClick={() => withdraw(a)} className="block ml-auto text-xs text-gray-500 underline">Withdraw</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JobProfilePage() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<OwnerView | null>(null);
  const [plans, setPlans] = useState<JobPlans | null>(null);
  const [p, setP] = useState<JobProfile>(EMPTY);
  const [period, setPeriod] = useState('month');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [planError, setPlanError] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const cvRef = useRef<HTMLInputElement>(null);

  const apply = (v: OwnerView) => { setView(v); if (v.profile) setP({ ...EMPTY, ...v.profile, links: { ...EMPTY.links, ...v.profile.links } }); };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id');
        if (params.get('checkout') === 'canceled') setNotice('Checkout was cancelled. You have not been charged.');
        const data = await jobsCall<OwnerView & JobPlans & { signedInEmail: string; signedInName: string }>({ action: 'profile.get' });
        setPlans(data);
        if (data.profile) apply(data);
        else {
          setView(data);
          const [first, ...rest] = (data.signedInName || user.name || '').split(' ');
          setP({ ...EMPTY, firstName: first ?? '', lastName: rest.join(' '), email: data.signedInEmail ?? '' });
        }
        if (sessionId) {
          window.history.replaceState({}, '', '/jobs/profile');
          apply(await jobsCall<OwnerView>({ action: 'subscribe.confirm', sessionId }));
          setNotice('Your plan is active. Your profile is now shown to companies.');
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not load your profile.');
      }
    })();
  }, [user, loadKey]);

  if (!loading && !user) {
    return (
      <div className="flex-1 bg-gray-50 py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your job profile</h1>
        <p className="text-gray-600 mb-6 max-w-lg mx-auto">Build a profile with your photo and CV, and Lyrtrip shows it to companies that are hiring. Plans from $5 a month.</p>
        <Link href="/login" onClick={() => rememberReturnTo('/jobs/profile')} className={primary}>Sign in to create your profile</Link>
      </div>
    );
  }
  if (!view || !plans) {
    return <PageLoader error={loadError} onRetry={() => { setLoadError(null); setLoadKey(k => k + 1); }} returnTo="/jobs/profile" />;
  }

  const set = <K extends keyof JobProfile>(k: K, v: JobProfile[K]) => { setP(x => ({ ...x, [k]: v })); setError(null); setNotice(null); };
  const toggle = (k: 'jobTypes' | 'workModes', v: string) => set(k, p[k].includes(v) ? p[k].filter(x => x !== v) : [...p[k], v]);
  const setJob = (i: number, k: keyof Experience, v: string | boolean) => set('experience', p.experience.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const setSchool = (i: number, k: keyof Education, v: string) => set('education', p.education.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name); setError(null); setNotice(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    setBusy(null);
  };
  const save = () => run('save', async () => {
    apply(await jobsCall<OwnerView>({ action: 'profile.save', profile: p }));
    setNotice('Profile saved.');
  });
  const upload = (kind: 'photo' | 'cv', file?: File) => file && run(kind, async () => {
    // Save typed changes first so the upload's reply doesn't overwrite them
    await jobsCall<OwnerView>({ action: 'profile.save', profile: p });
    apply(await uploadJobFile(kind, file));
    setNotice(kind === 'photo' ? 'Photo uploaded.' : 'CV uploaded.');
  });
  // What is still missing in the form as typed (the server checks the saved profile again)
  const missingNow = () => {
    const m: string[] = [];
    if (!p.firstName.trim() || !p.lastName.trim()) m.push('Full name');
    if (!view.hasPhoto) m.push('Profile photo');
    if (!view.hasCv) m.push('CV');
    if (p.headline.trim().length < 5) m.push('Headline');
    if (!p.city.trim() || !p.country.trim()) m.push('City and country');
    if (!p.email.trim()) m.push('Email');
    if (!p.phone.trim()) m.push('Phone');
    if (p.about.trim().length < 50) m.push('About you (at least 50 characters)');
    if (!p.desiredRoles.length) m.push('Roles you want');
    if (!p.jobTypes.length) m.push('Job types');
    if (!p.workModes.length) m.push('Work arrangement');
    if (p.yearsExperience == null) m.push('Years of experience');
    if (p.skills.length < 3) m.push('At least 3 skills');
    if (!p.languages.length) m.push('Languages');
    if (!p.availability) m.push('Availability');
    if (!p.firstJob && !p.experience.some(e => e.title && e.company && e.start)) m.push('Work experience (or tick "Looking for my first job")');
    if (!p.education.some(e => e.school)) m.push('Education');
    return m;
  };
  const subscribe = async (plan: string) => {
    setPlanError(null);
    const m = missingNow();
    if (m.length) { setPlanError(`To choose a plan, first add: ${m.join(', ')}.`); return; }
    setBusy(`sub-${plan}`);
    try {
      await jobsCall<OwnerView>({ action: 'profile.save', profile: p });
      const { url } = await jobsCall<{ url: string }>({ action: 'subscribe', plan, period });
      window.location.assign(url);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Could not open checkout.');
      setBusy(null);
    }
  };
  const setCancel = (cancel: boolean) => run('cancel', async () => {
    if (cancel && !confirm('Cancel your plan? Your profile stays listed until the end of the period you paid for.')) return;
    apply(await jobsCall<OwnerView>({ action: cancel ? 'subscription.cancel' : 'subscription.resume' }));
  });
  const remove = () => run('delete', async () => {
    if (!confirm('Delete your job profile, photo, CV and job applications? An active plan ends now and is not refunded.')) return;
    await jobsCall({ action: 'profile.delete' });
    setView({ ...view, profile: null, listed: false, subscription: null, live: false, hasPhoto: false, hasCv: false, photoUrl: null, cvUrl: null, missing: [] });
    setP(EMPTY);
    setNotice('Your job profile has been deleted.');
  });

  const sub = view.subscription;
  const planName = (id?: string) => plans.plans.find(x => x.id === id)?.name ?? id;
  const periodLabel = (id?: string) => plans.periods.find(x => x.id === id)?.label ?? id;
  const prices = plans.periods.find(x => x.id === period)?.price ?? {};

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your job profile</h1>
            <p className="text-gray-600 text-sm">Companies hiring on Lyrtrip see paid profiles in the talent directory. Fields marked {req} are required.</p>
          </div>
          {view.profile?.id && <Link href={`/talent?id=${view.profile.id}`} className="text-sm font-semibold text-brand-600">View as companies see it →</Link>}
        </div>

        {/* Status */}
        <div className={`${card} flex flex-wrap items-center gap-3`}>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${view.listed ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
            {view.listed ? 'Shown to companies' : view.hidden ? 'Hidden by Lyrtrip' : 'Not listed yet'}
          </span>
          {sub && view.live && <span className={`px-3 py-1 rounded-full text-sm font-semibold ${PLAN_STYLE[sub.plan]}`}>{planName(sub.plan)} · {periodLabel(sub.period)}</span>}
          {view.live && <span className="text-sm text-gray-600">{view.companyViews} compan{view.companyViews === 1 ? 'y has' : 'ies have'} viewed your profile</span>}
          {view.missing.length > 0 && (
            <p className="w-full text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">To be listed, add: {view.missing.join(', ')}.</p>
          )}
          {view.hidden && <p className="w-full text-sm text-red-700">Lyrtrip has hidden this profile. Contact support@lyrtrip.com.</p>}
        </div>

        {notice && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">{notice}</p>}
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {/* Photo and CV */}
        <div className={`${card} grid sm:grid-cols-2 gap-5`}>
          <div className="flex items-center gap-4">
            {view.photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={view.photoUrl} alt="Your profile photo" className="w-20 h-20 rounded-full object-cover ring-2 ring-white shadow" />
              : <span className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-3xl">🧑</span>}
            <div>
              <p className="text-sm font-semibold text-gray-900">Profile photo {req}</p>
              <p className="text-xs text-gray-500 mb-2">A clear photo of your face. JPG, PNG or WebP, up to 5 MB.</p>
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => upload('photo', e.target.files?.[0])} />
              <button onClick={() => photoRef.current?.click()} disabled={!!busy} className="text-sm font-semibold text-brand-600 disabled:text-gray-400">
                {busy === 'photo' ? 'Uploading…' : view.hasPhoto ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl">📄</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">CV / résumé {req}</p>
              <p className="text-xs text-gray-500 mb-2 truncate">{view.hasCv ? p.cvName ?? 'Uploaded' : 'PDF or Word, up to 8 MB.'}</p>
              <input ref={cvRef} type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={e => upload('cv', e.target.files?.[0])} />
              <button onClick={() => cvRef.current?.click()} disabled={!!busy} className="text-sm font-semibold text-brand-600 disabled:text-gray-400 mr-3">
                {busy === 'cv' ? 'Uploading…' : view.hasCv ? 'Replace CV' : 'Upload CV'}
              </button>
              {view.cvUrl && <a href={view.cvUrl} className="text-sm text-gray-600 underline">Download</a>}
            </div>
          </div>
        </div>

        {/* Basics */}
        <div className={`${card} grid sm:grid-cols-2 gap-4`}>
          <h2 className="sm:col-span-2 text-lg font-bold text-gray-900">About you</h2>
          <div><label className={label}>First name {req}</label><input className={input} value={p.firstName} onChange={e => set('firstName', e.target.value)} autoComplete="given-name" /></div>
          <div><label className={label}>Last name {req}</label><input className={input} value={p.lastName} onChange={e => set('lastName', e.target.value)} autoComplete="family-name" /></div>
          <div className="sm:col-span-2"><label className={label}>Headline {req}</label><input className={input} value={p.headline} maxLength={120} onChange={e => set('headline', e.target.value)} placeholder="e.g. Hotel front-desk manager · 6 years in hospitality" /></div>
          <div><label className={label}>City {req}</label><input className={input} value={p.city} onChange={e => set('city', e.target.value)} autoComplete="address-level2" /></div>
          <div><label className={label}>Country {req}</label><input className={input} value={p.country} onChange={e => set('country', e.target.value)} autoComplete="country-name" /></div>
          <div><label className={label}>Email {req}</label><input className={input} type="email" value={p.email} onChange={e => set('email', e.target.value)} autoComplete="email" /></div>
          <div><label className={label}>Phone {req}</label><input className={input} type="tel" value={p.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 415 555 2671" autoComplete="tel" /></div>
          <div className="sm:col-span-2">
            <label className={label}>Summary {req} <span className="font-normal text-gray-400">({p.about.length}/2000, at least 50)</span></label>
            <textarea className={`${input} min-h-[120px]`} value={p.about} maxLength={2000} onChange={e => set('about', e.target.value)} placeholder="What you do, what you're good at and what you're looking for." />
          </div>
          <p className="sm:col-span-2 text-xs text-gray-500">Your email, phone, CV and expected salary are shown only to approved companies, never publicly.</p>
        </div>

        {/* What you want */}
        <div className={`${card} grid sm:grid-cols-2 gap-4`}>
          <h2 className="sm:col-span-2 text-lg font-bold text-gray-900">What you&apos;re looking for</h2>
          <div className="sm:col-span-2"><label className={label}>Roles you want {req} <span className="font-normal text-gray-400">(up to 5, comma-separated)</span></label>
            <ListInput value={p.desiredRoles} onChange={v => set('desiredRoles', v.slice(0, 5))} placeholder="e.g. Tour guide, Travel consultant" /></div>
          <div className="sm:col-span-2"><label className={label}>Job types {req}</label>
            <div className="flex flex-wrap gap-2">{plans.options.jobTypes.map(t => <button key={t} type="button" onClick={() => toggle('jobTypes', t)} className={chip(p.jobTypes.includes(t))}>{t}</button>)}</div></div>
          <div className="sm:col-span-2"><label className={label}>Work arrangement {req}</label>
            <div className="flex flex-wrap gap-2">{plans.options.workModes.map(t => <button key={t} type="button" onClick={() => toggle('workModes', t)} className={chip(p.workModes.includes(t))}>{t}</button>)}</div></div>
          <div><label className={label}>Availability {req}</label>
            <select className={input} value={p.availability} onChange={e => set('availability', e.target.value)}>
              <option value="">Choose…</option>{plans.options.availability.map(a => <option key={a}>{a}</option>)}
            </select></div>
          <div><label className={label}>Expected salary <span className="font-normal text-gray-400">(optional)</span></label><input className={input} value={p.expectedSalary} onChange={e => set('expectedSalary', e.target.value)} placeholder="e.g. $45,000 a year" /></div>
          <div className="sm:col-span-2"><label className={label}>Work authorisation <span className="font-normal text-gray-400">(optional)</span></label><input className={input} value={p.workAuthorization} onChange={e => set('workAuthorization', e.target.value)} placeholder="e.g. EU citizen; US work visa needed" /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={p.willingToRelocate} onChange={e => set('willingToRelocate', e.target.checked)} /> Willing to relocate</label>
          <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={p.openToWork} onChange={e => set('openToWork', e.target.checked)} /> Show &quot;Open to work&quot;</label>
        </div>

        {/* Experience */}
        <div className={`${card} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Work experience {!p.firstJob && req}</h2>
            <button type="button" onClick={() => set('experience', [...p.experience, { ...NEW_JOB }])} className="text-sm font-semibold text-brand-600">+ Add a job</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={label}>Years of experience {req}</label>
              <input className={input} type="number" min={0} max={60} value={p.yearsExperience ?? ''} onChange={e => set('yearsExperience', e.target.value === '' ? null : Number(e.target.value))} /></div>
            <label className="flex items-end gap-2 text-sm text-gray-700 pb-3"><input type="checkbox" checked={p.firstJob} onChange={e => set('firstJob', e.target.checked)} /> Looking for my first job</label>
          </div>
          {p.experience.map((e, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-4 grid sm:grid-cols-2 gap-3">
              <div><label className={label}>Job title</label><input className={input} value={e.title} onChange={ev => setJob(i, 'title', ev.target.value)} /></div>
              <div><label className={label}>Company</label><input className={input} value={e.company} onChange={ev => setJob(i, 'company', ev.target.value)} /></div>
              <div><label className={label}>Location</label><input className={input} value={e.location} onChange={ev => setJob(i, 'location', ev.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label}>Start</label><input className={input} type="month" value={e.start} onChange={ev => setJob(i, 'start', ev.target.value)} /></div>
                <div><label className={label}>End</label><input className={input} type="month" value={e.end} disabled={e.current} onChange={ev => setJob(i, 'end', ev.target.value)} /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={e.current} onChange={ev => setJob(i, 'current', ev.target.checked)} /> I work here now</label>
              <button type="button" onClick={() => set('experience', p.experience.filter((_, j) => j !== i))} className="text-sm text-red-600 justify-self-end">Remove</button>
              <div className="sm:col-span-2"><label className={label}>What you did</label><textarea className={`${input} min-h-[80px]`} maxLength={1000} value={e.description} onChange={ev => setJob(i, 'description', ev.target.value)} /></div>
            </div>
          ))}
        </div>

        {/* Education */}
        <div className={`${card} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Education {req}</h2>
            <button type="button" onClick={() => set('education', [...p.education, { ...NEW_SCHOOL }])} className="text-sm font-semibold text-brand-600">+ Add education</button>
          </div>
          {p.education.length === 0 && <p className="text-sm text-gray-500">Add your school, college or training.</p>}
          {p.education.map((e, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-4 grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={label}>School, college or university</label><input className={input} value={e.school} onChange={ev => setSchool(i, 'school', ev.target.value)} /></div>
              <div><label className={label}>Qualification</label><input className={input} value={e.degree} onChange={ev => setSchool(i, 'degree', ev.target.value)} placeholder="e.g. BA, Diploma" /></div>
              <div><label className={label}>Field of study</label><input className={input} value={e.field} onChange={ev => setSchool(i, 'field', ev.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label}>From (year)</label><input className={input} inputMode="numeric" maxLength={4} value={e.start} onChange={ev => setSchool(i, 'start', ev.target.value)} /></div>
                <div><label className={label}>To (year)</label><input className={input} inputMode="numeric" maxLength={4} value={e.end} onChange={ev => setSchool(i, 'end', ev.target.value)} /></div>
              </div>
              <button type="button" onClick={() => set('education', p.education.filter((_, j) => j !== i))} className="text-sm text-red-600 justify-self-end self-end">Remove</button>
            </div>
          ))}
        </div>

        {/* Skills and links */}
        <div className={`${card} grid sm:grid-cols-2 gap-4`}>
          <h2 className="sm:col-span-2 text-lg font-bold text-gray-900">Skills and links</h2>
          <div className="sm:col-span-2"><label className={label}>Skills {req} <span className="font-normal text-gray-400">(at least 3, comma-separated)</span></label>
            <ListInput value={p.skills} onChange={v => set('skills', v.slice(0, 30))} placeholder="e.g. Customer service, Amadeus, Spanish, Excel" /></div>
          <div className="sm:col-span-2"><label className={label}>Languages {req}</label>
            <ListInput value={p.languages} onChange={v => set('languages', v.slice(0, 10))} placeholder="e.g. English (fluent), French (basic)" /></div>
          <div><label className={label}>LinkedIn</label><input className={input} value={p.links.linkedin} onChange={e => set('links', { ...p.links, linkedin: e.target.value })} placeholder="linkedin.com/in/…" /></div>
          <div><label className={label}>Portfolio or website</label><input className={input} value={p.links.portfolio} onChange={e => set('links', { ...p.links, portfolio: e.target.value })} /></div>
          <div><label className={label}>GitHub</label><input className={input} value={p.links.github} onChange={e => set('links', { ...p.links, github: e.target.value })} /></div>
        </div>

        <div className="sticky bottom-3 z-10 flex justify-end">
          <button onClick={save} disabled={!!busy} className={`${primary} shadow-lg`}>{busy === 'save' ? 'Saving…' : 'Save profile'}</button>
        </div>

        {/* Plans */}
        <div className={`${card} space-y-4`}>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Get seen by companies</h2>
            <p className="text-sm text-gray-600">Choose a plan to list your profile in the Lyrtrip talent directory. It renews automatically; cancel any time.</p>
          </div>
          {sub && view.live ? (
            <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-2">
              <p><span className="font-semibold">{planName(sub.plan)}</span>, billed {periodLabel(sub.period)?.toLowerCase()}.{' '}
                {sub.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '—'}.
                {sub.status === 'past_due' && <span className="text-red-700"> The last payment failed; Stripe is retrying your card.</span>}
              </p>
              <button onClick={() => setCancel(!sub.cancelAtPeriodEnd)} disabled={!!busy} className="text-sm font-semibold text-brand-600">
                {sub.cancelAtPeriodEnd ? 'Keep my plan' : 'Cancel plan'}
              </button>
              {sub.cancelAtPeriodEnd && <p className="text-xs text-gray-500">You can choose a different plan below after cancelling.</p>}
            </div>
          ) : null}
          {(!view.live || sub?.cancelAtPeriodEnd) && (<>
            <div className="flex flex-wrap gap-2">
              {plans.periods.map(x => <button key={x.id} onClick={() => setPeriod(x.id)} className={chip(period === x.id)}>{x.label}</button>)}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {plans.plans.map(pl => (
                <div key={pl.id} className={`rounded-2xl border p-4 flex flex-col ${pl.id === 'premium' ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}>
                  <p className="font-bold text-gray-900">{pl.name}{pl.id === 'premium' && <span className="ml-2 text-xs font-semibold text-amber-800">Most seen</span>}</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{usd(prices[pl.id] ?? pl.monthly)}<span className="text-sm font-medium text-gray-500"> / {PER[period] ?? period}</span></p>
                  {period !== 'month' && period !== 'week' && <p className="text-xs text-emerald-700">Saves {usd(Math.round((pl.monthly * ({ month3: 3, month6: 6, year: 12 }[period] ?? 1) - (prices[pl.id] ?? 0)) * 100) / 100)}</p>}
                  <ul className="mt-3 space-y-1 text-sm text-gray-700 flex-1">{pl.perks.map(k => <li key={k}>✓ {k}</li>)}</ul>
                  <button onClick={() => subscribe(pl.id)} disabled={!!busy}
                    className={`mt-4 ${primary} w-full`}>{busy === `sub-${pl.id}` ? 'Opening checkout…' : `Choose ${pl.name}`}</button>
                </div>
              ))}
            </div>
            {planError && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{planError}</p>}
          </>)}
        </div>

        <MyApplications />

        {view.profile && (
          <div className="text-center">
            <button onClick={remove} disabled={!!busy} className="text-sm text-red-600 underline">Delete my job profile</button>
          </div>
        )}
      </div>
    </div>
  );
}
