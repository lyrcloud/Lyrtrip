'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PLAN_STYLE } from '@/lib/jobs';
import {
  studyCall, uploadStudyDoc, STUDY_STATUS_STYLE,
  type StudentProfile, type StudyApplication, type StudyEducation, type StudyOwnerView, type StudyPlans, type StudyTest,
} from '@/lib/study';
import { rememberReturnTo } from '@/lib/returnTo';

const EMPTY: StudentProfile = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '', nationality: '', countryOfResidence: '', city: '', address: '', email: '', phone: '',
  passportNumber: '', passportExpiry: '', studyLevel: '', fieldsOfStudy: [], preferredCountries: [], intake: '', budgetPerYear: '', fundingSource: '',
  education: [], tests: [], englishWaiver: false, languages: [], workYears: null, goals: '', achievements: '', guardianName: '', guardianPhone: '',
};
const NEW_SCHOOL: StudyEducation = { school: '', qualification: '', field: '', grade: '', country: '', start: '', end: '' };
const NEW_TEST: StudyTest = { test: 'IELTS', score: '', date: '' };

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100';
const label = 'block text-xs font-semibold text-gray-600 mb-1';
const card = 'bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 sm:p-6';
const primary = 'px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition';
const chip = (on: boolean) => `px-3 py-1.5 rounded-full text-sm font-medium ring-1 transition ${on ? 'bg-btn text-white ring-btn' : 'bg-white text-gray-700 ring-gray-200 hover:ring-brand-300'}`;
const req = <span className="text-red-500">*</span>;
const usd = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;
const PER: Record<string, string> = { week: 'week', month: 'month', month3: '3 months', month6: '6 months', year: '12 months' };
const DOC_ACCEPT = '.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

// Admission and scholarship applications made through Lyrtrip, with fees to pay
function MyApplications({ reloadKey }: { reloadKey: number }) {
  const [apps, setApps] = useState<StudyApplication[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => studyCall<{ applications: StudyApplication[] }>({ action: 'applications.mine' }).then(d => setApps(d.applications)).catch(() => setApps([]));
  useEffect(() => { load(); }, [reloadKey]);
  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); } catch (err) { alert(err instanceof Error ? err.message : 'Something went wrong'); }
    setBusy(null);
    load();
  };
  const withdraw = (a: StudyApplication) => act(a.id, async () => {
    if (!confirm(`Withdraw your application to ${a.institution}?`)) return;
    await studyCall({ action: 'application.withdraw', id: a.id });
  });
  const pay = (a: StudyApplication) => act(a.id, async () => {
    const { url } = await studyCall<{ url: string }>({ action: 'fee.pay', id: a.id });
    window.location.href = url;
  });
  const resubmit = (a: StudyApplication) => act(a.id, async () => {
    await studyCall({ action: 'application.resubmit', id: a.id });
  });
  return (
    <div id="applications" className={card}>
      <h2 className="font-bold text-gray-900">My applications</h2>
      <p className="text-sm text-gray-600 mb-3">Apply from the Study tab. Lyrtrip prepares your application, tells you the institution&apos;s fee, and applies for you once it is paid.</p>
      {apps === null && <p className="text-sm text-gray-500">Loading…</p>}
      {apps?.length === 0 && <p className="text-sm text-gray-500">No applications yet. <Link href="/" className="text-brand-600 font-semibold">Search schools and scholarships</Link></p>}
      <div className="divide-y divide-gray-100">
        {apps?.map(a => (
          <div key={a.id} className="py-3 flex flex-wrap items-start justify-between gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900">{a.program} <span className="font-normal text-gray-500">· {a.type === 'scholarship' ? 'Scholarship' : 'Admission'}</span></p>
              <p className="text-gray-600">{[a.institution, a.address].filter(Boolean).join(' · ')}</p>
              <p className="text-xs text-gray-400">Applied {new Date(a.createdAt).toLocaleDateString()}{a.intake ? ` · intake ${a.intake}` : ''}</p>
              {a.fee && (
                <p className="mt-1 text-gray-700">
                  {a.fee.label} {usd(a.fee.fee)} + Lyrtrip service {usd(a.fee.service)} = <span className="font-semibold">{usd(a.fee.total)}</span>
                  {a.fee.paidAt && <span className="text-emerald-700"> · paid {new Date(a.fee.paidAt).toLocaleDateString()}</span>}
                </p>
              )}
              {a.message && <p className="mt-1 text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-2">{a.message}</p>}
            </div>
            <div className="text-right space-y-1">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STUDY_STATUS_STYLE[a.status] ?? ''}`}>{a.statusLabel}</span>
              {a.status === 'fee_due' && a.fee && (
                <button onClick={() => pay(a)} disabled={busy === a.id} className="block ml-auto mt-1 px-3 py-1.5 bg-btn text-white rounded-lg text-xs font-semibold disabled:bg-gray-300">
                  {busy === a.id ? 'Opening…' : `Pay ${usd(a.fee.total)}`}
                </button>
              )}
              {a.status === 'docs_needed' && (
                <button onClick={() => resubmit(a)} disabled={busy === a.id} className="block ml-auto mt-1 px-3 py-1.5 bg-btn text-white rounded-lg text-xs font-semibold disabled:bg-gray-300">
                  Send my updated documents
                </button>
              )}
              {['submitted', 'docs_needed', 'fee_due'].includes(a.status) && (
                <button onClick={() => withdraw(a)} className="block ml-auto text-xs text-gray-500 underline">Withdraw</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudyProfilePage() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<StudyOwnerView | null>(null);
  const [plans, setPlans] = useState<StudyPlans | null>(null);
  const [p, setP] = useState<StudentProfile>(EMPTY);
  const [period, setPeriod] = useState('month');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appsKey, setAppsKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<string | null>(null);

  const apply = (v: StudyOwnerView) => { setView(v); if (v.profile) setP({ ...EMPTY, ...v.profile }); };

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('session_id'), feeSession = params.get('fee_session');
        if (params.get('checkout') === 'canceled') setNotice('Checkout was cancelled. You have not been charged.');
        const data = await studyCall<StudyOwnerView & StudyPlans & { signedInEmail: string; signedInName: string }>({ action: 'profile.get' });
        setPlans(data);
        if (data.profile) apply(data);
        else {
          setView(data);
          const [first, ...rest] = (data.signedInName || user.name || '').split(' ');
          setP({ ...EMPTY, firstName: first ?? '', lastName: rest.join(' '), email: data.signedInEmail ?? '' });
        }
        if (sessionId || feeSession) window.history.replaceState({}, '', `/study/profile${feeSession ? '#applications' : ''}`);
        if (sessionId) {
          apply(await studyCall<StudyOwnerView>({ action: 'subscribe.confirm', sessionId }));
          setNotice('Your study plan is active. Apply to schools and scholarships from the Study tab.');
        }
        if (feeSession) {
          await studyCall({ action: 'fee.confirm', sessionId: feeSession });
          setNotice('Fee paid. Lyrtrip is applying for you now and will email you each update.');
          setAppsKey(k => k + 1);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your profile.');
      }
    })();
  }, [user]);

  if (!loading && !user) {
    return (
      <div className="flex-1 bg-gray-50 py-16 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your student profile</h1>
        <p className="text-gray-600 mb-6 max-w-lg mx-auto">Keep every document schools and scholarships ask for in one place, and Lyrtrip applies for you. Plans from $5 a month.</p>
        <Link href="/login" onClick={() => rememberReturnTo('/study/profile')} className={primary}>Sign in to create your profile</Link>
      </div>
    );
  }
  if (!view || !plans) {
    return <div className="flex-1 flex items-center justify-center bg-gray-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>;
  }

  const set = <K extends keyof StudentProfile>(k: K, v: StudentProfile[K]) => { setP(x => ({ ...x, [k]: v })); setError(null); setNotice(null); };
  const setSchool = (i: number, k: keyof StudyEducation, v: string) => set('education', p.education.map((e, j) => (j === i ? { ...e, [k]: v } : e)));
  const setTest = (i: number, k: keyof StudyTest, v: string) => set('tests', p.tests.map((e, j) => (j === i ? { ...e, [k]: v } : e)));

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name); setError(null); setNotice(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    setBusy(null);
  };
  const save = () => run('save', async () => {
    apply(await studyCall<StudyOwnerView>({ action: 'profile.save', profile: p }));
    setNotice('Profile saved.');
  });
  const pickFile = (kind: string) => { pendingKind.current = kind; if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } };
  const upload = (file?: File) => {
    const kind = pendingKind.current;
    if (!file || !kind) return;
    run(`doc-${kind}`, async () => {
      // Save typed changes first so the upload's reply doesn't overwrite them
      await studyCall<StudyOwnerView>({ action: 'profile.save', profile: p });
      apply(await uploadStudyDoc(kind, file));
      setNotice(`${plans.docTypes.find(d => d.id === kind)?.label ?? 'Document'} uploaded.`);
    });
  };
  const removeDoc = (kind: string) => run(`doc-${kind}`, async () => {
    if (!confirm('Remove this document?')) return;
    apply(await studyCall<StudyOwnerView>({ action: 'doc.remove', kind }));
  });
  const subscribe = (plan: string) => run(`sub-${plan}`, async () => {
    await studyCall<StudyOwnerView>({ action: 'profile.save', profile: p });
    const { url } = await studyCall<{ url: string }>({ action: 'subscribe', plan, period });
    window.location.href = url;
  });
  const setCancel = (cancel: boolean) => run('cancel', async () => {
    if (cancel && !confirm('Cancel your plan? You can keep applying until the end of the period you paid for.')) return;
    apply(await studyCall<StudyOwnerView>({ action: cancel ? 'subscription.cancel' : 'subscription.resume' }));
  });
  const remove = () => run('delete', async () => {
    if (!confirm('Delete your student profile, all documents and applications? An active plan ends now and is not refunded.')) return;
    await studyCall({ action: 'profile.delete' });
    setView({ ...view, profile: null, docs: {}, photoUrl: null, subscription: null, live: false, appsUsed: 0, appsLimit: 0 });
    setP(EMPTY);
    setAppsKey(k => k + 1);
    setNotice('Your student profile has been deleted.');
  });

  const sub = view.subscription;
  const planName = (id?: string) => plans.plans.find(x => x.id === id)?.name ?? id;
  const periodLabel = (id?: string) => plans.periods.find(x => x.id === id)?.label ?? id;
  const prices = plans.periods.find(x => x.id === period)?.price ?? {};
  const pct = Math.round(plans.serviceRate * 100);
  const docNeed = (d: StudyPlans['docs'][number]) =>
    d.waivable && p.englishWaiver ? 'Not needed (English waiver)'
      : d.for.length === 2 ? 'Admission and scholarship' : d.for[0] === 'scholarship' ? 'Scholarship' : 'Optional';

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <input ref={fileRef} type="file" accept={DOC_ACCEPT} className="hidden" onChange={e => upload(e.target.files?.[0])} />
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your student profile</h1>
          <p className="text-gray-600 text-sm">Everything schools and scholarships ask for, in one place. Lyrtrip applies for you. Fields marked {req} are required.</p>
        </div>

        {/* Status */}
        <div className={`${card} space-y-3`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${view.missing.admission.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
              {view.missing.admission.length === 0 ? 'Ready for admission' : 'Admission: not ready'}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${view.missing.scholarship.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
              {view.missing.scholarship.length === 0 ? 'Ready for scholarships' : 'Scholarships: not ready'}
            </span>
            {sub && view.live && <span className={`px-3 py-1 rounded-full text-sm font-semibold ${PLAN_STYLE[sub.plan]}`}>{planName(sub.plan)} · {view.appsLimit - view.appsUsed} of {view.appsLimit} applications left</span>}
          </div>
          {view.missing.admission.length > 0 && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">For admission, add: {view.missing.admission.join(', ')}.</p>}
          {view.missing.scholarship.length > 0 && view.missing.admission.length === 0 && <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">For scholarships, also add: {view.missing.scholarship.join(', ')}.</p>}
        </div>

        {notice && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">{notice}</p>}
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        {/* Personal */}
        <div className={`${card} grid sm:grid-cols-2 gap-4`}>
          <h2 className="sm:col-span-2 text-lg font-bold text-gray-900">Personal details <span className="text-sm font-normal text-gray-500">(as on your passport)</span></h2>
          <div><label className={label}>First name {req}</label><input className={input} value={p.firstName} onChange={e => set('firstName', e.target.value)} autoComplete="given-name" /></div>
          <div><label className={label}>Last name {req}</label><input className={input} value={p.lastName} onChange={e => set('lastName', e.target.value)} autoComplete="family-name" /></div>
          <div><label className={label}>Date of birth {req}</label><input className={input} type="date" value={p.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} autoComplete="bday" /></div>
          <div><label className={label}>Gender <span className="font-normal text-gray-400">(optional)</span></label><input className={input} value={p.gender} onChange={e => set('gender', e.target.value)} /></div>
          <div><label className={label}>Nationality {req}</label><input className={input} value={p.nationality} onChange={e => set('nationality', e.target.value)} /></div>
          <div><label className={label}>Country of residence {req}</label><input className={input} value={p.countryOfResidence} onChange={e => set('countryOfResidence', e.target.value)} autoComplete="country-name" /></div>
          <div><label className={label}>City {req}</label><input className={input} value={p.city} onChange={e => set('city', e.target.value)} autoComplete="address-level2" /></div>
          <div><label className={label}>Home address <span className="font-normal text-gray-400">(optional)</span></label><input className={input} value={p.address} onChange={e => set('address', e.target.value)} autoComplete="street-address" /></div>
          <div><label className={label}>Email {req}</label><input className={input} type="email" value={p.email} onChange={e => set('email', e.target.value)} autoComplete="email" /></div>
          <div><label className={label}>Phone {req}</label><input className={input} type="tel" value={p.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 900123" autoComplete="tel" /></div>
          <div><label className={label}>Passport number {req}</label><input className={input} value={p.passportNumber} onChange={e => set('passportNumber', e.target.value)} /></div>
          <div><label className={label}>Passport expiry {req}</label><input className={input} type="date" value={p.passportExpiry} onChange={e => set('passportExpiry', e.target.value)} /></div>
          <div><label className={label}>Parent / guardian name <span className="font-normal text-gray-400">(under 18)</span></label><input className={input} value={p.guardianName} onChange={e => set('guardianName', e.target.value)} /></div>
          <div><label className={label}>Parent / guardian phone</label><input className={input} type="tel" value={p.guardianPhone} onChange={e => set('guardianPhone', e.target.value)} /></div>
          <p className="sm:col-span-2 text-xs text-gray-500">Your details and documents are shared only with the institutions Lyrtrip applies to for you.</p>
        </div>

        {/* Study goals */}
        <div className={`${card} grid sm:grid-cols-2 gap-4`}>
          <h2 className="sm:col-span-2 text-lg font-bold text-gray-900">What you want to study</h2>
          <div className="sm:col-span-2"><label className={label}>Level {req}</label>
            <div className="flex flex-wrap gap-2">{plans.options.levels.map(l => <button key={l} type="button" onClick={() => set('studyLevel', l)} className={chip(p.studyLevel === l)}>{l}</button>)}</div></div>
          <div className="sm:col-span-2"><label className={label}>Fields of study {req} <span className="font-normal text-gray-400">(up to 5, comma-separated)</span></label>
            <ListInput value={p.fieldsOfStudy} onChange={v => set('fieldsOfStudy', v.slice(0, 5))} placeholder="e.g. Computer science, Data science" /></div>
          <div className="sm:col-span-2"><label className={label}>Countries you want to study in {req}</label>
            <ListInput value={p.preferredCountries} onChange={v => set('preferredCountries', v.slice(0, 5))} placeholder="e.g. Canada, Germany, UK" /></div>
          <div><label className={label}>Intake (start) {req}</label><input className={input} type="month" value={p.intake} onChange={e => set('intake', e.target.value)} /></div>
          <div><label className={label}>Budget per year <span className="font-normal text-gray-400">(optional)</span></label><input className={input} value={p.budgetPerYear} onChange={e => set('budgetPerYear', e.target.value)} placeholder="e.g. $20,000" /></div>
          <div className="sm:col-span-2"><label className={label}>How you will pay {req}</label>
            <div className="flex flex-wrap gap-2">{plans.options.funding.map(f => <button key={f} type="button" onClick={() => set('fundingSource', f)} className={chip(p.fundingSource === f)}>{f}</button>)}</div></div>
          <div className="sm:col-span-2">
            <label className={label}>Study goals {req} <span className="font-normal text-gray-400">({p.goals.length}/2000, at least 50)</span></label>
            <textarea className={`${input} min-h-[110px]`} value={p.goals} maxLength={2000} onChange={e => set('goals', e.target.value)} placeholder="What you want to study, why, and what you plan to do after." />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Achievements and activities <span className="font-normal text-gray-400">(required for scholarships, at least 30)</span></label>
            <textarea className={`${input} min-h-[90px]`} value={p.achievements} maxLength={2000} onChange={e => set('achievements', e.target.value)} placeholder="Awards, ranks, sports, volunteering, research, leadership." />
          </div>
        </div>

        {/* Education */}
        <div className={`${card} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Education {req}</h2>
            <button type="button" onClick={() => set('education', [...p.education, { ...NEW_SCHOOL }])} className="text-sm font-semibold text-brand-600">+ Add education</button>
          </div>
          {p.education.length === 0 && <p className="text-sm text-gray-500">Add your school, college or university, with your grade.</p>}
          {p.education.map((e, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-4 grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={label}>School, college or university</label><input className={input} value={e.school} onChange={ev => setSchool(i, 'school', ev.target.value)} /></div>
              <div><label className={label}>Qualification</label><input className={input} value={e.qualification} onChange={ev => setSchool(i, 'qualification', ev.target.value)} placeholder="e.g. High school diploma, BSc" /></div>
              <div><label className={label}>Field</label><input className={input} value={e.field} onChange={ev => setSchool(i, 'field', ev.target.value)} /></div>
              <div><label className={label}>Grade / GPA / %</label><input className={input} value={e.grade} onChange={ev => setSchool(i, 'grade', ev.target.value)} placeholder="e.g. 3.6/4, 85%, First class" /></div>
              <div><label className={label}>Country</label><input className={input} value={e.country} onChange={ev => setSchool(i, 'country', ev.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={label}>From (year)</label><input className={input} inputMode="numeric" maxLength={4} value={e.start} onChange={ev => setSchool(i, 'start', ev.target.value)} /></div>
                <div><label className={label}>To (year)</label><input className={input} inputMode="numeric" maxLength={4} value={e.end} onChange={ev => setSchool(i, 'end', ev.target.value)} /></div>
              </div>
              <button type="button" onClick={() => set('education', p.education.filter((_, j) => j !== i))} className="text-sm text-red-600 justify-self-end self-end">Remove</button>
            </div>
          ))}
        </div>

        {/* Tests and languages */}
        <div className={`${card} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Test scores and languages</h2>
            <button type="button" onClick={() => set('tests', [...p.tests, { ...NEW_TEST }])} className="text-sm font-semibold text-brand-600">+ Add a test</button>
          </div>
          {p.tests.map((t, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div><label className={label}>Test</label>
                <select className={input} value={t.test} onChange={e => setTest(i, 'test', e.target.value)}>{plans.options.tests.map(x => <option key={x}>{x}</option>)}</select></div>
              <div><label className={label}>Score</label><input className={input} value={t.score} onChange={e => setTest(i, 'score', e.target.value)} placeholder="e.g. 7.0" /></div>
              <div><label className={label}>Taken</label><input className={input} type="month" value={t.date} onChange={e => setTest(i, 'date', e.target.value)} /></div>
              <button type="button" onClick={() => set('tests', p.tests.filter((_, j) => j !== i))} className="text-sm text-red-600 pb-3 justify-self-start">Remove</button>
            </div>
          ))}
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-1" checked={p.englishWaiver} onChange={e => set('englishWaiver', e.target.checked)} />
            English waiver: I am a native English speaker or studied in English, so I don&apos;t have an English test score
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={label}>Languages</label><ListInput value={p.languages} onChange={v => set('languages', v.slice(0, 10))} placeholder="e.g. English (fluent), Hindi (native)" /></div>
            <div><label className={label}>Years of work experience</label>
              <input className={input} type="number" min={0} max={60} value={p.workYears ?? ''} onChange={e => set('workYears', e.target.value === '' ? null : Number(e.target.value))} /></div>
          </div>
        </div>

        <div className="sticky bottom-3 z-10 flex justify-end">
          <button onClick={save} disabled={!!busy} className={`${primary} shadow-lg`}>{busy === 'save' ? 'Saving…' : 'Save profile'}</button>
        </div>

        {/* Documents */}
        <div className={`${card} space-y-3`}>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Documents</h2>
            <p className="text-sm text-gray-600">PDF, Word or a clear photo (JPG, PNG), up to 10 MB each. Scans must be readable and in colour.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {plans.docTypes.map(d => {
              const have = view.docs[d.id];
              const needed = d.for.length > 0 && !(d.waivable && p.englishWaiver);
              return (
                <div key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{have ? '✅' : needed ? '⬜' : '➖'} {d.label} {d.for.includes('admission') && !(d.waivable && p.englishWaiver) && req}</p>
                    <p className="text-xs text-gray-500 truncate">{have ? have.name : docNeed(d)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {have?.url && <a href={have.url} className="text-gray-600 underline">Download</a>}
                    {have && <button onClick={() => removeDoc(d.id)} disabled={!!busy} className="text-red-600">Remove</button>}
                    <button onClick={() => pickFile(d.id)} disabled={!!busy} className="font-semibold text-brand-600 disabled:text-gray-400">
                      {busy === `doc-${d.id}` ? 'Uploading…' : have ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plans */}
        <div id="plans" className={`${card} space-y-4`}>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Apply through Lyrtrip</h2>
            <p className="text-sm text-gray-600">A plan lets Lyrtrip apply to schools, universities and scholarships for you. It renews automatically; cancel any time.
              Each institution&apos;s own admission or scholarship fee is paid per application, plus our {pct}% service charge.</p>
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
            </div>
          ) : null}
          {(!view.live || sub?.cancelAtPeriodEnd) && (<>
            <div className="flex flex-wrap gap-2">
              {plans.periods.map(x => <button key={x.id} onClick={() => setPeriod(x.id)} className={chip(period === x.id)}>{x.label}</button>)}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {plans.plans.map(pl => (
                <div key={pl.id} className={`rounded-2xl border p-4 flex flex-col ${pl.id === 'premium' ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`}>
                  <p className="font-bold text-gray-900">{pl.name}</p>
                  <p className="text-2xl font-black text-gray-900 mt-1">{usd(prices[pl.id] ?? pl.monthly)}<span className="text-sm font-medium text-gray-500"> / {PER[period] ?? period}</span></p>
                  {period !== 'month' && period !== 'week' && <p className="text-xs text-emerald-700">Saves {usd(Math.round((pl.monthly * ({ month3: 3, month6: 6, year: 12 }[period] ?? 1) - (prices[pl.id] ?? 0)) * 100) / 100)}</p>}
                  <ul className="mt-3 space-y-1 text-sm text-gray-700 flex-1">{pl.perks.map(k => <li key={k}>✓ {k}</li>)}</ul>
                  <button onClick={() => subscribe(pl.id)} disabled={!!busy} className={`mt-4 ${primary} w-full`}>
                    {busy === `sub-${pl.id}` ? 'Opening checkout…' : `Choose ${pl.name}`}
                  </button>
                </div>
              ))}
            </div>
          </>)}
        </div>

        <MyApplications reloadKey={appsKey} />

        {view.profile && (
          <div className="text-center">
            <button onClick={remove} disabled={!!busy} className="text-sm text-red-600 underline">Delete my student profile</button>
          </div>
        )}
      </div>
    </div>
  );
}
