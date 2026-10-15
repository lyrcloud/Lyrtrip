'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '@/lib/auth';
import {
  AffiliatesPanel, BusinessPanel, CouponsPanel, GiftCardsPanel, RewardsPanel, SettingsPanel, ShipmentsPanel, DeliveriesPanel, RidesPanel, JobProfilesPanel, JobApplicationsPanel, StudyApplicationsPanel, EventTicketsPanel, TourRequestsPanel, DonationsPanel, HeliRequestsPanel, FreightRequestsPanel, TIER_STYLE,
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

type Tab = 'users' | 'shipments' | 'deliveries' | 'rides' | 'jobs' | 'jobapps' | 'studyapps' | 'eventtix' | 'tourreqs' | 'heli' | 'freight' | 'donations' | 'rewards' | 'business' | 'affiliates' | 'coupons' | 'giftcards' | 'settings' | 'tours' | 'flights';

const ROLE_STYLE: Record<Role, string> = {
  superadmin: 'bg-purple-100 text-purple-800',
  admin:      'bg-blue-100 text-blue-800',
  user:       'bg-gray-100 text-gray-700',
};

const ROLE_LABEL: Record<Role, string> = { superadmin: 'Super admin', admin: 'Admin', user: 'User' };

export default function AdminPage() {
  const [me, setMe]           = useState<{ email: string; role: Role } | null>(null);
  const [tab, setTab]         = useState<Tab>('users');
  const [users, setUsers]     = useState<AdminUser[] | null>(null);
  const [tours, setTours]     = useState<AdminTour[] | null>(null);
  const [flights, setFlights] = useState<AdminFlight[] | null>(null);
  const [rewards, setRewards] = useState<{ accounts: RewardsAccount[]; settings: RewardsSettings; tiers: { name: string; points: number }[] } | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);
  const [query, setQuery]     = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit]       = useState({ name: '', password: '' });
  const [draft, setDraft]     = useState({ email: '', name: '', password: '', role: 'user' as 'user' | 'admin' });
  const [showCreate, setShowCreate] = useState(false);

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
  }, [call]);

  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, payload: Record<string, unknown>) => {
    setBusy(key);
    try {
      await call(payload);
      await load();
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
  const shownUsers = (users ?? []).filter(u => !q || `${u.email} ${u.name} ${u.provider}`.toLowerCase().includes(q));

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run('create', {
      action: 'users.create', email: draft.email, name: draft.name, password: draft.password,
      ...(isSuper ? { role: draft.role } : {}),
    });
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

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
  const smallBtn = 'px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50';
  const dangerBtn = 'px-2.5 py-1 rounded-md text-xs font-medium border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50';

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin console</h1>
            {me && <p className="text-sm text-gray-500">{me.email} · {ROLE_LABEL[me.role]}</p>}
          </div>
          <div className="flex gap-2">
            <Link href="/admin/hotels" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700">Hotel requests</Link>
            <button onClick={load} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700">Refresh</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">
            {error} <Link href="/login" className="underline font-semibold">Sign in</Link>
          </div>
        )}
        {!error && !me && <p className="text-gray-500">Loading…</p>}

        {me && (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                ['users', `Users (${users?.length ?? 0})`],
                ['rewards', 'Points & tiers'],
                ['business', `Business (B2B)${pendingBusiness ? ` · ${pendingBusiness} pending` : ''}`],
                ['affiliates', 'Affiliates'],
                ['coupons', 'Coupons'],
                ['giftcards', 'Gift cards'],
                ['settings', 'Settings'],
                ['tours', `Tours (${tours?.length ?? 0})`],
                ['flights', `Flight bookings (${flights?.length ?? 0})`],
                ['shipments', 'Shipments'],
                ['deliveries', 'Courier deliveries'],
                ['rides', 'Rides'],
                ['jobs', 'Job profiles'],
                ['jobapps', 'Job applications'],
                ['studyapps', 'Study applications'],
                ['eventtix', 'Event tickets'],
                ['tourreqs', 'Tour requests'],
                ['heli', 'Air charters'],
                ['freight', 'Freight & trucks'],
                ['donations', 'Donations'],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === key ? 'bg-btn text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by email, name or sign-in method"
                    className={`${input} flex-1 min-w-[200px] bg-white`} />
                  <button onClick={() => setShowCreate(v => !v)} className="px-3 py-2 rounded-lg text-sm font-medium bg-btn text-white hover:bg-btn-hover">
                    {showCreate ? 'Close' : 'Add user'}
                  </button>
                </div>

                {showCreate && (
                  <form onSubmit={createUser} className="bg-white rounded-xl border border-gray-200 p-4 grid sm:grid-cols-2 gap-3">
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
                    <button type="submit" disabled={busy === 'create'} className="sm:col-span-2 px-4 py-2 rounded-lg text-sm font-medium bg-btn text-white hover:bg-btn-hover disabled:opacity-50">
                      {busy === 'create' ? 'Creating…' : 'Create account'}
                    </button>
                  </form>
                )}

                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {shownUsers.length === 0 && <p className="p-4 text-sm text-gray-500">No users found.</p>}
                  {shownUsers.map(u => (
                    <div key={u.username} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 break-all">{u.email || u.username}</p>
                          <p className="text-sm text-gray-600">{u.name || '—'}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5 text-xs">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${ROLE_STYLE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                            {(() => {
                              const a = accountOf(u.sub);
                              return (
                                <>
                                  <span className={`px-2 py-0.5 rounded-full font-bold ${TIER_STYLE[a?.tier ?? 'Member']}`}>{a?.tier ?? 'Member'}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{(a?.points_balance ?? 0).toLocaleString()} pts</span>
                                  {a?.business?.status === 'approved' && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">B2B · {a.business.company}</span>}
                                </>
                              );
                            })()}
                            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{u.provider}</span>
                            {u.status === 'UNCONFIRMED' && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Email not verified</span>}
                            {!u.enabled && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">Disabled</span>}
                            {u.createdAt && <span className="text-gray-400 py-0.5">joined {new Date(u.createdAt).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        {canManage(u) && (
                          <div className="flex flex-wrap gap-1.5">
                            <button className={smallBtn} disabled={busy !== null}
                              onClick={() => { setEditing(editing === u.username ? null : u.username); setEdit({ name: u.name, password: '' }); }}>
                              Edit
                            </button>
                            {isSuper && u.role !== 'superadmin' && (
                              <button className={smallBtn} disabled={busy !== null}
                                onClick={() => run(u.username, { action: 'users.update', username: u.username, role: u.role === 'admin' ? 'user' : 'admin' })}>
                                {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                              </button>
                            )}
                            {u.role !== 'superadmin' && (
                              <button className={smallBtn} disabled={busy !== null}
                                onClick={() => run(u.username, { action: 'users.update', username: u.username, enabled: !u.enabled })}>
                                {u.enabled ? 'Disable' : 'Enable'}
                              </button>
                            )}
                            {u.role !== 'superadmin' && (
                              <button className={dangerBtn} disabled={busy !== null}
                                onClick={() => window.confirm(`Delete ${u.email || u.username}? This can't be undone.`) && run(u.username, { action: 'users.delete', username: u.username })}>
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {editing === u.username && (
                        <div className="grid sm:grid-cols-3 gap-2 mt-3">
                          <input className={input} placeholder="Full name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} />
                          {u.provider === 'Email' ? (
                            <input className={input} type="password" autoComplete="new-password" placeholder="New password (optional)"
                              value={edit.password} onChange={e => setEdit({ ...edit, password: e.target.value })} />
                          ) : <p className="text-xs text-gray-500 self-center">Signs in with {u.provider}, so there&apos;s no password to set.</p>}
                          <button className="px-3 py-2 rounded-lg text-sm font-medium bg-btn text-white hover:bg-btn-hover disabled:opacity-50"
                            disabled={busy === u.username} onClick={() => saveEdit(u)}>
                            {busy === u.username ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'rewards' && (
              <RewardsPanel call={call} isSuper={isSuper} users={users ?? []} accounts={rewards?.accounts ?? []} reload={load} />
            )}
            {tab === 'business' && (
              <BusinessPanel call={call} isSuper={isSuper} accounts={rewards?.accounts ?? []} settings={rewards?.settings ?? null} reload={load} />
            )}
            {tab === 'affiliates' && <AffiliatesPanel accounts={rewards?.accounts ?? []} settings={rewards?.settings ?? null} />}
            {tab === 'shipments' && <ShipmentsPanel call={call} />}
            {tab === 'deliveries' && <DeliveriesPanel call={call} />}
            {tab === 'rides' && <RidesPanel call={call} />}
            {tab === 'jobs' && <JobProfilesPanel call={call} />}
            {tab === 'jobapps' && <JobApplicationsPanel call={call} />}
            {tab === 'studyapps' && <StudyApplicationsPanel call={call} />}
            {tab === 'eventtix' && <EventTicketsPanel call={call} />}
            {tab === 'tourreqs' && <TourRequestsPanel call={call} />}
            {tab === 'heli' && <HeliRequestsPanel call={call} />}
            {tab === 'freight' && <FreightRequestsPanel call={call} />}
            {tab === 'donations' && <DonationsPanel call={call} />}
            {tab === 'coupons' && <CouponsPanel call={call} isSuper={isSuper} />}
            {tab === 'giftcards' && <GiftCardsPanel call={call} isSuper={isSuper} />}
            {tab === 'settings' && (
              <SettingsPanel call={call} isSuper={isSuper} settings={rewards?.settings ?? null} tiers={rewards?.tiers ?? []} reload={load} />
            )}

            {tab === 'tours' && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {(tours ?? []).length === 0 && <p className="p-4 text-sm text-gray-500">No tours yet.</p>}
                {(tours ?? []).map(t => (
                  <div key={t.id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{t.title}{t.artist ? ` · ${t.artist}` : ''}</p>
                      <p className="text-sm text-gray-600">{t.start_date} → {t.end_date}{t.status ? ` · ${t.status}` : ''}{t.budget ? ` · budget $${t.budget}` : ''}</p>
                      <p className="text-xs text-gray-400">Owner {ownerOf(t.user_id)}</p>
                    </div>
                    <button className={dangerBtn} disabled={busy !== null}
                      onClick={() => window.confirm(`Delete the tour "${t.title}"?`) && run(t.id, { action: 'tours.delete', id: t.id })}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'flights' && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {(flights ?? []).length === 0 && <p className="p-4 text-sm text-gray-500">No flight bookings yet.</p>}
                {(flights ?? []).map(f => (
                  <div key={f.id} className="p-4 flex flex-wrap items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {f.from ?? '?'} → {f.to ?? '?'}{f.depart ? ` · ${f.depart}` : ''}
                        {f.testBooking && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800">test</span>}
                      </p>
                      <p className="text-gray-600">{f.passengers.map(p => p.name).join(', ') || '—'}</p>
                      <p className="text-xs text-gray-400">
                        {f.pnr ? `PNR ${f.pnr} · ` : ''}Booked by {ownerOf(f.userSub)}{f.createdAt ? ` · ${new Date(f.createdAt).toLocaleString()}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{f.markedUpPrice != null ? `${Number(f.markedUpPrice).toFixed(2)} ${f.currency ?? ''}` : '—'}</p>
                      {f.amountPaid != null && f.amountPaid !== f.markedUpPrice && <p className="text-xs text-gray-500">{Number(f.amountPaid).toFixed(2)} by card</p>}
                      {f.buyerType === 'business' && <p className="text-xs text-emerald-700">B2B</p>}
                      <p className="text-xs text-gray-500">{f.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
