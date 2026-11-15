'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSession } from '@/lib/auth';
import {
  AffiliatesPanel, BusinessPanel, CouponsPanel, GiftCardsPanel, RewardsPanel, SettingsPanel, ShipmentsPanel, DeliveriesPanel, RidesPanel, JobProfilesPanel, JobApplicationsPanel, StudyApplicationsPanel, EventTicketsPanel, TourRequestsPanel, DonationsPanel, HeliRequestsPanel, FreightRequestsPanel, LegalRequestsPanel, TIER_STYLE,
  type RewardsAccount, type RewardsSettings,
} from '@/components/admin/RewardsAdmin';

type Role = 'superadmin' | 'admin' | 'user';

interface AdminUser {
  username: string;
  sub: string;
  email: string;
  name: string;
  provider: string;
  status: string;
  enabled: boolean;
  createdAt: string | null;
  role: Role;
}

interface AdminTour {
  id: string;
  user_id: string;
  title: string;
  artist?: string;
  start_date: string;
  end_date: string;
  status?: string;
  budget?: number;
}

interface AdminFlight {
  id: string;
  status: string;
  testBooking: boolean;
  userSub: string | null;
  pnr: string | null;
  passengers: { name: string; email: string | null }[];
  from: string | null;
  to: string | null;
  depart: string | null;
  markedUpPrice: number | null;
  amountPaid: number | null;
  buyerType: 'consumer' | 'business' | null;
  currency: string | null;
  createdAt: string | null;
}

// Every page of the console. The Users page holds everything about people: accounts, points, business, affiliates.
type Section = 'overview' | 'users' | 'flights' | 'tours' | 'shipments' | 'deliveries' | 'rides' | 'eventtix' | 'tourreqs' | 'heli' | 'freight'
  | 'legal' | 'donations' | 'jobs' | 'jobapps' | 'studyapps' | 'coupons' | 'giftcards' | 'settings';
type UserTab = 'accounts' | 'rewards' | 'business' | 'affiliates';

const NAV: { group: string; items: [Section, string, string][] }[] = [
  { group: 'Dashboard', items: [['overview', '📊', 'Overview']] },
  { group: 'People', items: [['users', '👥', 'Users']] },
  { group: 'Bookings', items: [['flights', '✈️', 'Flight bookings'], ['tours', '🗺️', 'Tours'], ['shipments', '📦', 'Shipments'], ['deliveries', '🛵', 'Courier deliveries'], ['rides', '🚗', 'Rides']] },
  { group: 'Requests', items: [['eventtix', '🎟️', 'Event tickets'], ['tourreqs', '🕌', 'Tour requests'], ['heli', '🚁', 'Air charters'], ['freight', '🚚', 'Freight & trucks'], ['legal', '⚖️', 'Tax & legal'], ['donations', '💝', 'Donations']] },
  { group: 'Careers & study', items: [['jobs', '🧑‍💼', 'Job profiles'], ['jobapps', '📨', 'Job applications'], ['studyapps', '🎓', 'Study applications']] },
  { group: 'Promotions', items: [['coupons', '🏷️', 'Coupons'], ['giftcards', '🎁', 'Gift cards']] },
  { group: 'System', items: [['settings', '⚙️', 'Settings']] },
];
const ALL_ITEMS = NAV.flatMap(g => g.items);
const LABEL = Object.fromEntries(ALL_ITEMS.map(([k, , l]) => [k, l])) as Record<Section, string>;
const ICON = Object.fromEntries(ALL_ITEMS.map(([k, i]) => [k, i])) as Record<Section, string>;
const USER_TABS: [UserTab, string, string][] = [['accounts', '🪪', 'Accounts'], ['rewards', '⭐', 'Points & tiers'], ['business', '🏢', 'Business (B2B)'], ['affiliates', '🤝', 'Affiliates']];

const ROLE_STYLE: Record<Role, string> = {
  superadmin: 'bg-purple-100 text-purple-800 ring-purple-200',
  admin:      'bg-blue-100 text-blue-800 ring-blue-200',
  user:       'bg-gray-100 text-gray-700 ring-gray-200',
};
const ROLE_LABEL: Record<Role, string> = { superadmin: 'Super admin', admin: 'Admin', user: 'User' };
const AVATAR = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-sky-500', 'bg-violet-500', 'bg-teal-500'];
const initials = (u: AdminUser) => ((u.name || u.email || u.username).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('') || '?').toUpperCase();
const colorOf = (s: string) => AVATAR[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR.length];

const readHash = (): { section: Section; userTab: UserTab } | null => {
  const [s, sub] = window.location.hash.replace('#', '').split('/');
  if (!ALL_ITEMS.some(([k]) => k === s)) return null;
  return { section: s as Section, userTab: USER_TABS.some(([k]) => k === sub) ? sub as UserTab : 'accounts' };
};

export default function AdminPage() {
  const [me, setMe]           = useState<{ email: string; role: Role } | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [userTab, setUserTab] = useState<UserTab>('accounts');
  const [users, setUsers]     = useState<AdminUser[] | null>(null);
  const [tours, setTours]     = useState<AdminTour[] | null>(null);
  const [flights, setFlights] = useState<AdminFlight[] | null>(null);
  const [rewards, setRewards] = useState<{ accounts: RewardsAccount[]; settings: RewardsSettings; tiers: { name: string; points: number }[] } | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);
  const [query, setQuery]     = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'admins' | 'disabled' | 'unverified' | 'business'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit]       = useState({ name: '', password: '' });
  const [draft, setDraft]     = useState({ email: '', name: '', password: '', role: 'user' as 'user' | 'admin' });
  const [showCreate, setShowCreate] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const navSearch = useRef<HTMLInputElement>(null);

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const session = await getSession();
    if (!session?.idToken) throw new Error('Please sign in with your admin account.');
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res  = await fetch(`${baseUrl}/api/admin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...payload, idToken: session.idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [meData, userData, tourData, flightData, rewardsData] = await Promise.all([
        call({ action: 'me' }),
        call({ action: 'users.list' }),
        call({ action: 'tours.list' }),
        call({ action: 'flights.list' }),
        call({ action: 'rewards.list' }),
      ]);
      setMe(meData);
      setUsers(userData.users);
      setTours(tourData.tours);
      setFlights(flightData.bookings);
      setRewards(rewardsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the admin console');
    }
    setRefreshing(false);
  }, [call]);

  useEffect(() => { void load(); }, [load]);

  // The address bar remembers the page (#jobapps, #users/business), so links and the back button work
  useEffect(() => {
    const apply = () => { const h = readHash(); if (h) { setSection(h.section); setUserTab(h.userTab); } };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);
  const go = (s: Section, sub?: UserTab) => {
    const hash = s === 'users' && sub && sub !== 'accounts' ? `#users/${sub}` : `#${s}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setSection(s);
    if (s === 'users') setUserTab(sub ?? 'accounts');
    setNavOpen(false);
    setNavQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // "/" jumps to the section search, Esc closes the menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '');
      if (e.key === '/' && !typing) { e.preventDefault(); setNavOpen(true); setTimeout(() => navSearch.current?.focus(), 0); }
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const run = async (key: string, payload: Record<string, unknown>, done = 'Saved') => {
    setBusy(key);
    try {
      await call(payload);
      await load();
      setToast(done);
      return true;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Action failed');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const isSuper = me?.role === 'superadmin';
  // Admins manage regular users; only the super admin touches admin accounts.
  const canManage = (u: AdminUser) => u.role === 'user' || (isSuper && u.role === 'admin') || (isSuper && u.email === me?.email);
  const ownerOf = (sub: string | null) => {
    const u = sub ? users?.find(x => x.sub === sub) : undefined;
    return u ? u.email || u.name || u.username : sub ? 'Deleted account' : 'Guest';
  };

  const accountOf = (sub: string) => rewards?.accounts.find(a => a.sub === sub);
  const pendingBusiness = rewards?.accounts.filter(a => a.business?.status === 'pending').length ?? 0;

  const q = query.trim().toLowerCase();
  const shownUsers = (users ?? []).filter(u => (!q || `${u.email} ${u.name} ${u.provider}`.toLowerCase().includes(q)) && (
    userFilter === 'all' || (userFilter === 'admins' && u.role !== 'user') || (userFilter === 'disabled' && !u.enabled)
    || (userFilter === 'unverified' && u.status === 'UNCONFIRMED') || (userFilter === 'business' && accountOf(u.sub)?.business?.status === 'approved')));

  const stats = useMemo(() => {
    const paid = (flights ?? []).filter(f => !f.testBooking && f.status !== 'failed');
    const week = Date.now() - 7 * 864e5;
    return {
      users: users?.length ?? 0,
      newUsers: (users ?? []).filter(u => u.createdAt && Date.parse(u.createdAt) > week).length,
      admins: (users ?? []).filter(u => u.role !== 'user').length,
      flights: paid.length,
      revenue: paid.reduce((s, f) => s + (Number(f.amountPaid ?? f.markedUpPrice) || 0), 0),
      tours: tours?.length ?? 0,
      points: (rewards?.accounts ?? []).reduce((s, a) => s + (a.points_balance ?? 0), 0),
    };
  }, [users, flights, tours, rewards]);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run('create', {
      action: 'users.create', email: draft.email, name: draft.name, password: draft.password,
      ...(isSuper ? { role: draft.role } : {}),
    }, 'Account created');
    if (ok) {
      setDraft({ email: '', name: '', password: '', role: 'user' });
      setShowCreate(false);
    }
  };

  const saveEdit = async (u: AdminUser) => {
    const ok = await run(u.username, {
      action: 'users.update', username: u.username, name: edit.name,
      ...(edit.password ? { password: edit.password } : {}),
    });
    if (ok) setEditing(null);
  };

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white';
  const smallBtn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:ring-gray-300 disabled:opacity-50';
  const dangerBtn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ring-1 ring-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50';
  const card = 'admin-panel bg-white rounded-2xl border border-gray-200/80 shadow-sm';
  const nq = navQuery.trim().toLowerCase();

  const Sidebar = (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2 px-1">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg text-white shadow">⚡</span>
        <div className="leading-tight">
          <p className="font-bold text-gray-900">Lyrtrip admin</p>
          {me && <p className="text-[11px] text-gray-500">{ROLE_LABEL[me.role]}</p>}
        </div>
      </div>
      <div className="relative">
        <input ref={navSearch} value={navQuery} onChange={e => setNavQuery(e.target.value)} placeholder="Find a page…  ( / )"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm" />
      </div>
      {NAV.map(g => {
        const items = g.items.filter(([, , l]) => !nq || l.toLowerCase().includes(nq) || g.group.toLowerCase().includes(nq)
          || (g.group === 'People' && USER_TABS.some(([, , ul]) => ul.toLowerCase().includes(nq))));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">{g.group}</p>
            <div className="space-y-0.5">
              {items.map(([k, icon, label]) => (
                <div key={k}>
                  <button onClick={() => go(k)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium ${section === k ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' : 'text-gray-700 hover:bg-gray-100'}`}>
                    <span className="w-5 text-center" aria-hidden>{icon}</span>
                    <span className="flex-1">{label}</span>
                    {k === 'users' && <span className="rounded-full bg-gray-100 px-2 text-[11px] text-gray-600">{users?.length ?? 0}</span>}
                    {k === 'users' && pendingBusiness > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white" title="Business accounts to review">{pendingBusiness}</span>}
                    {k === 'flights' && <span className="rounded-full bg-gray-100 px-2 text-[11px] text-gray-600">{flights?.length ?? 0}</span>}
                  </button>
                  {k === 'users' && section === 'users' && (
                    <div className="ml-7 mt-0.5 space-y-0.5 border-l border-gray-200 pl-2">
                      {USER_TABS.map(([ut, , ul]) => (
                        <button key={ut} onClick={() => go('users', ut)}
                          className={`block w-full rounded-lg px-2 py-1 text-left text-xs font-medium ${userTab === ut ? 'text-indigo-700' : 'text-gray-500 hover:text-gray-800'}`}>{ul}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-gray-100 pt-3">
        <Link href="/admin/hotels" className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"><span className="w-5 text-center">🏨</span>Hotel requests ↗</Link>
        <Link href="/" className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"><span className="w-5 text-center">🏠</span>Back to site</Link>
      </div>
    </nav>
  );

  const StatCard = ({ icon, label, value, sub, to, tone }: { icon: string; label: string; value: string; sub?: string; to?: Section; tone: string }) => (
    <button onClick={() => to && go(to)} className={`${card} group p-4 text-left hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${tone}`}>{icon}</span>
        {to && <span className="text-xs text-gray-400 group-hover:text-indigo-600">Open →</span>}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-emerald-600">{sub}</p>}
    </button>
  );

  return (
    <div className="admin-shell flex-1 bg-gradient-to-b from-slate-50 to-gray-100 min-h-screen">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
        <button onClick={() => setNavOpen(true)} className="rounded-lg px-2 py-1 text-xl" aria-label="Open menu">☰</button>
        <p className="font-semibold text-gray-900">{ICON[section]} {LABEL[section]}</p>
        <button onClick={load} className="rounded-lg px-2 py-1 text-lg" aria-label="Refresh">{refreshing ? '⏳' : '↻'}</button>
      </div>
      {navOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setNavOpen(false)} />}
      <div className="mx-auto flex max-w-[92rem]">
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-gray-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${navOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
          {Sidebar}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 hidden flex-wrap items-center justify-between gap-3 lg:flex">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{NAV.find(g => g.items.some(([k]) => k === section))?.group}</p>
              <h1 className="text-2xl font-bold text-gray-900">{ICON[section]} {LABEL[section]}{section === 'users' ? ` · ${USER_TABS.find(([k]) => k === userTab)?.[2]}` : ''}</h1>
            </div>
            <div className="flex items-center gap-3">
              {me && (
                <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-gray-600 ring-1 ring-gray-200">
                  <span className={`h-2 w-2 rounded-full ${isSuper ? 'bg-purple-500' : 'bg-blue-500'}`} />{me.email}
                </span>
              )}
              <button onClick={load} disabled={refreshing} className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
                {refreshing ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error} <Link href="/login" className="font-semibold underline">Sign in</Link>
            </div>
          )}
          {!error && !me && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/70" />)}
            </div>
          )}

          {me && (
            <div key={`${section}-${userTab}`} className="admin-fade space-y-5">
              {section === 'overview' && (<>
                <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-lg">
                  <p className="text-sm opacity-80">Welcome back</p>
                  <p className="text-2xl font-bold">{me.email}</p>
                  <p className="mt-1 text-sm opacity-80">{ROLE_LABEL[me.role]} · press <kbd className="rounded bg-white/20 px-1.5">/</kbd> to jump to any page</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard icon="👥" label="Users" value={stats.users.toLocaleString()} sub={stats.newUsers ? `+${stats.newUsers} this week` : undefined} to="users" tone="bg-indigo-50" />
                  <StatCard icon="✈️" label="Flight bookings" value={stats.flights.toLocaleString()} sub={stats.revenue ? `$${stats.revenue.toFixed(0)} taken` : undefined} to="flights" tone="bg-sky-50" />
                  <StatCard icon="⭐" label="Points held by members" value={stats.points.toLocaleString()} to="users" tone="bg-amber-50" />
                  <StatCard icon="🏢" label="Business accounts to review" value={String(pendingBusiness)} to="users" tone="bg-emerald-50" />
                </div>
                <div className={`${card} p-5`}>
                  <p className="mb-3 font-semibold text-gray-900">All pages</p>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {NAV.filter(g => g.group !== 'Dashboard').map(g => (
                      <div key={g.group}>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">{g.group}</p>
                        <div className="flex flex-wrap gap-2">
                          {(g.group === 'People' ? USER_TABS.map(([k, i, l]) => ['users', i, l, k] as const) : g.items.map(([k, i, l]) => [k, i, l, undefined] as const)).map(([k, i, l, sub]) => (
                            <button key={`${k}-${l}`} onClick={() => go(k as Section, sub)} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200">
                              <span aria-hidden>{i}</span>{l}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>)}

              {section === 'users' && (<>
                <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm ring-1 ring-gray-200">
                  {USER_TABS.map(([k, icon, label]) => (
                    <button key={k} onClick={() => go('users', k)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${userTab === k ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                      <span aria-hidden>{icon}</span>{label}
                      {k === 'business' && pendingBusiness > 0 && <span className={`rounded-full px-1.5 text-[11px] ${userTab === k ? 'bg-white/25' : 'bg-amber-500 text-white'}`}>{pendingBusiness}</span>}
                    </button>
                  ))}
                </div>

                {userTab === 'accounts' && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-4">
                      {([['Total', stats.users, 'all'], ['Admins', stats.admins, 'admins'], ['Disabled', (users ?? []).filter(u => !u.enabled).length, 'disabled'], ['Not verified', (users ?? []).filter(u => u.status === 'UNCONFIRMED').length, 'unverified']] as const).map(([l, v, f]) => (
                        <button key={l} onClick={() => setUserFilter(f)} className={`${card} p-3 text-left ${userFilter === f ? 'ring-2 ring-indigo-500' : ''}`}>
                          <p className="text-xs text-gray-500">{l}</p><p className="text-xl font-bold text-gray-900">{v}</p>
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="relative min-w-[200px] flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by email, name or sign-in method" className={`${input} pl-9`} />
                      </div>
                      <select value={userFilter} onChange={e => setUserFilter(e.target.value as typeof userFilter)} className={`${input} w-auto`}>
                        <option value="all">Everyone</option><option value="admins">Admins</option><option value="business">Business accounts</option>
                        <option value="disabled">Disabled</option><option value="unverified">Email not verified</option>
                      </select>
                      <button onClick={() => setShowCreate(v => !v)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700">
                        {showCreate ? 'Close' : '＋ Add user'}
                      </button>
                    </div>

                    {showCreate && (
                      <form onSubmit={createUser} className={`${card} admin-fade grid gap-3 p-5 sm:grid-cols-2`}>
                        <p className="font-semibold text-gray-900 sm:col-span-2">New account</p>
                        <input className={input} type="email" required placeholder="Email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
                        <input className={input} placeholder="Full name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
                        <input className={input} type="password" required minLength={8} placeholder="Password" autoComplete="new-password"
                          value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} />
                        {isSuper ? (
                          <select className={input} value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as 'user' | 'admin' })}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : <div />}
                        <p className="text-xs text-gray-500 sm:col-span-2">
                          The account is ready to use straight away with this password (8+ characters with upper and lower case, a number and a symbol). No email is sent.
                        </p>
                        <button type="submit" disabled={busy === 'create'} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:col-span-2">
                          {busy === 'create' ? 'Creating…' : 'Create account'}
                        </button>
                      </form>
                    )}

                    <div className={`${card} divide-y divide-gray-100`}>
                      <p className="px-4 py-2.5 text-xs text-gray-500">{shownUsers.length} of {users?.length ?? 0} accounts</p>
                      {shownUsers.length === 0 && <p className="p-6 text-center text-sm text-gray-500">No users found.</p>}
                      {shownUsers.map(u => {
                        const a = accountOf(u.sub);
                        return (
                          <div key={u.username} className="p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner ${colorOf(u.email || u.username)} ${!u.enabled ? 'opacity-40' : ''}`}>{initials(u)}</span>
                                <div className="min-w-0">
                                  <p className="break-all font-semibold text-gray-900">{u.email || u.username}</p>
                                  <p className="text-sm text-gray-600">{u.name || '—'}</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                                    <span className={`rounded-full px-2 py-0.5 font-bold ring-1 ${ROLE_STYLE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                                    <span className={`rounded-full px-2 py-0.5 font-bold ${TIER_STYLE[a?.tier ?? 'Member']}`}>{a?.tier ?? 'Member'}</span>
                                    <button onClick={() => go('users', 'rewards')} className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100" title="Open Points & tiers">⭐ {(a?.points_balance ?? 0).toLocaleString()} pts</button>
                                    {a?.business?.status === 'approved' && <button onClick={() => go('users', 'business')} className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">🏢 {a.business.company}</button>}
                                    {a?.business?.status === 'pending' && <button onClick={() => go('users', 'business')} className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">B2B request pending</button>}
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">{u.provider}</span>
                                    {u.status === 'UNCONFIRMED' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Email not verified</span>}
                                    {!u.enabled && <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">Disabled</span>}
                                    {u.createdAt && <span className="py-0.5 text-gray-400">joined {new Date(u.createdAt).toLocaleDateString()}</span>}
                                  </div>
                                </div>
                              </div>
                              {canManage(u) && (
                                <div className="flex flex-wrap gap-1.5">
                                  <button className={smallBtn} disabled={busy !== null}
                                    onClick={() => { setEditing(editing === u.username ? null : u.username); setEdit({ name: u.name, password: '' }); }}>
                                    ✏️ Edit
                                  </button>
                                  {isSuper && u.role !== 'superadmin' && (
                                    <button className={smallBtn} disabled={busy !== null}
                                      onClick={() => run(u.username, { action: 'users.update', username: u.username, role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? 'Admin access removed' : 'Made admin')}>
                                      🛡️ {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                                    </button>
                                  )}
                                  {u.role !== 'superadmin' && (
                                    <button className={smallBtn} disabled={busy !== null}
                                      onClick={() => run(u.username, { action: 'users.update', username: u.username, enabled: !u.enabled }, u.enabled ? 'Account disabled' : 'Account enabled')}>
                                      {u.enabled ? '⏸ Disable' : '▶ Enable'}
                                    </button>
                                  )}
                                  {u.role !== 'superadmin' && (
                                    <button className={dangerBtn} disabled={busy !== null}
                                      onClick={() => window.confirm(`Delete ${u.email || u.username}? This can't be undone.`) && run(u.username, { action: 'users.delete', username: u.username }, 'Account deleted')}>
                                      🗑 Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {editing === u.username && (
                              <div className="admin-fade mt-3 grid gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-3">
                                <input className={input} placeholder="Full name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
                                {u.provider === 'Email' ? (
                                  <input className={input} type="password" autoComplete="new-password" placeholder="New password (optional)"
                                    value={edit.password} onChange={e => setEdit({ ...edit, password: e.target.value })} />
                                ) : <p className="self-center text-xs text-gray-500">Signs in with {u.provider}, so there&apos;s no password to set.</p>}
                                <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                  disabled={busy === u.username} onClick={() => saveEdit(u)}>
                                  {busy === u.username ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {userTab === 'rewards' && <RewardsPanel call={call} isSuper={isSuper} users={users ?? []} accounts={rewards?.accounts ?? []} reload={load} />}
                {userTab === 'business' && <BusinessPanel call={call} isSuper={isSuper} accounts={rewards?.accounts ?? []} settings={rewards?.settings ?? null} reload={load} />}
                {userTab === 'affiliates' && <AffiliatesPanel accounts={rewards?.accounts ?? []} settings={rewards?.settings ?? null} />}
              </>)}

              {section === 'shipments' && <ShipmentsPanel call={call} />}
              {section === 'deliveries' && <DeliveriesPanel call={call} />}
              {section === 'rides' && <RidesPanel call={call} />}
              {section === 'jobs' && <JobProfilesPanel call={call} />}
              {section === 'jobapps' && <JobApplicationsPanel call={call} />}
              {section === 'studyapps' && <StudyApplicationsPanel call={call} />}
              {section === 'eventtix' && <EventTicketsPanel call={call} />}
              {section === 'tourreqs' && <TourRequestsPanel call={call} />}
              {section === 'heli' && <HeliRequestsPanel call={call} />}
              {section === 'freight' && <FreightRequestsPanel call={call} />}
              {section === 'legal' && <LegalRequestsPanel call={call} />}
              {section === 'donations' && <DonationsPanel call={call} />}
              {section === 'coupons' && <CouponsPanel call={call} isSuper={isSuper} />}
              {section === 'giftcards' && <GiftCardsPanel call={call} isSuper={isSuper} />}
              {section === 'settings' && (
                <SettingsPanel call={call} isSuper={isSuper} settings={rewards?.settings ?? null} tiers={rewards?.tiers ?? []} reload={load} />
              )}

              {section === 'tours' && (
                <div className={`${card} divide-y divide-gray-100`}>
                  {(tours ?? []).length === 0 && <p className="p-6 text-center text-sm text-gray-500">No tours yet.</p>}
                  {(tours ?? []).map(t => (
                    <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{t.title}{t.artist ? ` · ${t.artist}` : ''}</p>
                        <p className="text-sm text-gray-600">{t.start_date} → {t.end_date}{t.status ? ` · ${t.status}` : ''}{t.budget ? ` · budget $${t.budget}` : ''}</p>
                        <p className="text-xs text-gray-400">Owner {ownerOf(t.user_id)}</p>
                      </div>
                      <button className={dangerBtn} disabled={busy !== null}
                        onClick={() => window.confirm(`Delete the tour "${t.title}"?`) && run(t.id, { action: 'tours.delete', id: t.id }, 'Tour deleted')}>
                        🗑 Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {section === 'flights' && (
                <div className={`${card} divide-y divide-gray-100`}>
                  {(flights ?? []).length === 0 && <p className="p-6 text-center text-sm text-gray-500">No flight bookings yet.</p>}
                  {(flights ?? []).map(f => (
                    <div key={f.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-lg">✈️</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {f.from ?? '?'} → {f.to ?? '?'}{f.depart ? ` · ${f.depart}` : ''}
                            {f.testBooking && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">test</span>}
                          </p>
                          <p className="text-gray-600">{f.passengers.map(p => p.name).join(', ') || '—'}</p>
                          <p className="text-xs text-gray-400">
                            {f.pnr ? `PNR ${f.pnr} · ` : ''}Booked by {ownerOf(f.userSub)}{f.createdAt ? ` · ${new Date(f.createdAt).toLocaleString()}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{f.markedUpPrice != null ? `${Number(f.markedUpPrice).toFixed(2)} ${f.currency ?? ''}` : '—'}</p>
                        {f.amountPaid != null && f.amountPaid !== f.markedUpPrice && <p className="text-xs text-gray-500">{Number(f.amountPaid).toFixed(2)} by card</p>}
                        {f.buyerType === 'business' && <p className="text-xs text-emerald-700">B2B</p>}
                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{f.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {toast && (
        <div className="admin-fade fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg">✓ {toast}</div>
      )}
    </div>
  );
}
