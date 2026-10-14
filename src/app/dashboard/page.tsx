'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getAdminRole, listTours } from '@/lib/api';
import { rewardsCall } from '@/lib/rewards';
import type { Tour } from '@/types/database';
import { getBookings, cancelBooking, type Booking } from '@/lib/bookings';

function initialsFor(name?: string, email?: string) {
  if (name) {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return email?.[0]?.toUpperCase() || '?';
}

const providerLabel: Record<string, string> = {
  Google: 'Signed in with Google',
  Facebook: 'Signed in with Facebook',
  WeChat: 'Signed in with WeChat',
  cognito: 'Signed in with email',
};

// Shortcuts into the home page's search tabs and the account pages
const QUICK_ACTIONS = [
  { href: '/?tab=flights', icon: '✈️', label: 'Flights',     tint: 'bg-sky-50 text-sky-700 ring-sky-100' },
  { href: '/?tab=hotels',  icon: '🏨', label: 'Hotels',      tint: 'bg-violet-50 text-violet-700 ring-violet-100' },
  { href: '/?tab=car',     icon: '🚗', label: 'Rides',       tint: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  { href: '/?tab=dash',    icon: '🛵', label: 'Courier',     tint: 'bg-amber-50 text-amber-700 ring-amber-100' },
  { href: '/?tab=tourism', icon: '🎒', label: 'Tours',       tint: 'bg-teal-50 text-teal-700 ring-teal-100' },
  { href: '/?tab=events',  icon: '🎟️', label: 'Events',      tint: 'bg-rose-50 text-rose-700 ring-rose-100' },
  { href: '/rewards',      icon: '⭐', label: 'Rewards',     tint: 'bg-yellow-50 text-yellow-700 ring-yellow-100' },
  { href: '/?tab=shipping', icon: '📦', label: 'Shipping',   tint: 'bg-orange-50 text-orange-700 ring-orange-100' },
];

interface Trip {
  id: string;
  kind: 'flight' | 'hotel' | 'shipment' | 'delivery';
  status: string;
  title: string;
  subtitle: string;
  start: string | null;
  end: string | null;
  total: number;
  paid: number;
  currency: string;
  receiptUrl: string | null;
  testBooking: boolean;
  createdAt: string;
}

interface RewardsSnapshot {
  points: number;
  pointsValue: number;
  pointsLifetime: number;
  giftCardBalance: number;
  tier: string;
  nextTier: { name: string; pointsNeeded: number } | null;
  referral: { link: string; percent: number };
  business: { company: string; status: string } | null;
}

const TRIP_STATUS: Record<string, [string, string]> = {
  confirmed:      ['Confirmed', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  processing:     ['Ticketing', 'bg-sky-50 text-sky-700 ring-sky-200'],
  requested:      ['Awaiting hotel', 'bg-amber-50 text-amber-700 ring-amber-200'],
  declining:      ['Refunding', 'bg-gray-50 text-gray-600 ring-gray-200'],
  declined:       ['Refunded', 'bg-gray-50 text-gray-600 ring-gray-200'],
  refunded:       ['Refunded', 'bg-gray-50 text-gray-600 ring-gray-200'],
  booking_failed: ['Needs support', 'bg-rose-50 text-rose-700 ring-rose-200'],
  needs_review:   ['Finishing up', 'bg-amber-50 text-amber-700 ring-amber-200'],
  label_failed:   ['Needs support', 'bg-rose-50 text-rose-700 ring-rose-200'],
  active:         ['On the way', 'bg-sky-50 text-sky-700 ring-sky-200'],
  delivered:      ['Delivered', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  canceled:       ['Canceled', 'bg-gray-50 text-gray-600 ring-gray-200'],
  returned:       ['Returned', 'bg-amber-50 text-amber-700 ring-amber-200'],
};
const CLOSED = new Set(['declined', 'refunded', 'booking_failed', 'declining', 'label_failed', 'delivered', 'canceled', 'returned']);
const TRIP_ICON = { flight: ['✈️', 'bg-sky-50'], hotel: ['🏨', 'bg-violet-50'], shipment: ['📦', 'bg-amber-50'], delivery: ['🛵', 'bg-emerald-50'] } as const;

const TIER_TINT: Record<string, string> = {
  Member: 'bg-gray-100 text-gray-700', Bronze: 'bg-amber-100 text-amber-800', Silver: 'bg-slate-100 text-slate-700',
  Gold: 'bg-yellow-100 text-yellow-800', Platinum: 'bg-indigo-100 text-indigo-700',
};

const fmtDate = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (n: number, currency = 'USD') => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

const card = 'bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)]';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tours, setTours] = useState<Tour[]>([]);
  const [adminRole, setAdminRole] = useState<'superadmin' | 'admin' | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [rewards, setRewards] = useState<RewardsSnapshot | null>(null);
  const [tripFilter, setTripFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    listTours().then(res => setTours(res.tours)).catch(() => setTours([]));
    rewardsCall<{ trips: Trip[] }>({ action: 'trips' }).then(res => setTrips(res.trips)).catch(() => setTrips([]));
    rewardsCall<RewardsSnapshot>({ action: 'summary' }).then(setRewards).catch(() => setRewards(null));
    // Saved on this device (localStorage), so read after mount
    Promise.resolve().then(() => setBookings(getBookings()));
    getAdminRole().then(setAdminRole);
  }, [user]);

  const handleCancelBooking = (id: string) => {
    cancelBooking(id);
    setBookings(getBookings());
  };

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  const today = new Date(now).toISOString().slice(0, 10);
  // A shipment stays "upcoming" for two weeks after its label, while it's on the way
  const isUpcoming = (t: Trip) => !CLOSED.has(t.status)
    && (t.kind === 'shipment' || t.kind === 'delivery' ? now - new Date(t.createdAt).getTime() < 14 * 864e5 : (t.end ?? t.start ?? today) >= today);
  const upcomingTrips = (trips ?? []).filter(isUpcoming).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const shownTrips = tripFilter === 'upcoming' ? upcomingTrips
    : tripFilter === 'past' ? (trips ?? []).filter(t => !isUpcoming(t))
    : trips ?? [];
  const nextTrip = upcomingTrips[0];
  const daysToNext = nextTrip?.start
    ? Math.max(0, Math.round((new Date(`${nextTrip.start.slice(0, 10)}T12:00:00`).getTime() - now) / 864e5))
    : null;
  const pendingLocal = bookings.filter(b => b.status === 'pending_payment');
  const tierProgress = rewards?.nextTier
    ? Math.min(100, Math.round(100 * rewards.pointsLifetime / (rewards.pointsLifetime + rewards.nextTier.pointsNeeded)))
    : 100;
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const stats = [
    { label: 'Points', value: rewards ? rewards.points.toLocaleString() : '—', hint: rewards ? `Worth ${fmtMoney(rewards.pointsValue)}` : '', tint: 'text-amber-600 bg-amber-50', icon: '⭐' },
    { label: 'Upcoming trips', value: trips ? String(upcomingTrips.length) : '—', hint: daysToNext != null ? (daysToNext === 0 ? 'Next one is today' : `Next in ${daysToNext} day${daysToNext !== 1 ? 's' : ''}`) : 'Nothing booked yet', tint: 'text-sky-600 bg-sky-50', icon: '🧳' },
    { label: 'Trips booked', value: trips ? String(trips.length) : '—', hint: 'Flights and hotels', tint: 'text-violet-600 bg-violet-50', icon: '🗺️' },
    { label: 'Gift card balance', value: rewards ? fmtMoney(rewards.giftCardBalance) : '—', hint: 'Use it at checkout', tint: 'text-pink-600 bg-pink-50', icon: '🎁' },
  ];

  const copyReferral = () => {
    if (!rewards) return;
    navigator.clipboard?.writeText(rewards.referral.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex-1 bg-linear-to-b from-brand-50/60 via-slate-50 to-sky-50/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Welcome */}
        <div className={`${card} p-6 sm:p-8 bg-linear-to-r from-white via-white to-sky-50/70`}>
          <div className="flex flex-wrap items-center gap-5">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" className="w-16 h-16 rounded-2xl object-cover ring-4 ring-brand-50" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-700 text-xl font-bold flex items-center justify-center ring-4 ring-brand-50">
                {initialsFor(user.name, user.email)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500">{greeting}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">{user.name || user.email?.split('@')[0] || 'Traveller'}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1">{providerLabel[user.provider || 'cognito']}</span>
                {rewards && <span className={`rounded-full px-2.5 py-1 font-semibold ${TIER_TINT[rewards.tier] ?? TIER_TINT.Member}`}>{rewards.tier} member</span>}
                {rewards?.business?.status === 'approved' && <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 font-medium">Business · {rewards.business.company}</span>}
                {adminRole && (
                  <Link href="/admin" className="rounded-full bg-violet-50 text-violet-700 px-2.5 py-1 font-semibold hover:bg-violet-100">
                    {adminRole === 'superadmin' ? 'Super admin console' : 'Admin console'} →
                  </Link>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/?tab=flights" className="rounded-xl bg-btn px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-btn-hover">Book a trip</Link>
              <Link href="/rewards" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Rewards</Link>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {QUICK_ACTIONS.map(a => (
            <Link key={a.label} href={a.href}
              className={`group flex flex-col items-center gap-1.5 rounded-2xl p-3 ring-1 transition hover:-translate-y-0.5 hover:shadow-md ${a.tint}`}>
              <span className="text-2xl transition-transform group-hover:scale-110">{a.icon}</span>
              <span className="text-xs font-semibold">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className={`${card} p-5`}>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{s.label}</p>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.tint}`}>{s.icon}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.hint}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Trips */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`${card} p-5 sm:p-6`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-slate-900">My trips &amp; shipments</h2>
                <div className="flex rounded-xl bg-slate-100 p-1 text-sm">
                  {(['upcoming', 'past', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setTripFilter(f)}
                      className={`px-3 py-1 rounded-lg font-medium capitalize transition ${tripFilter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {trips === null ? (
                <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-slate-50 animate-pulse" />)}</div>
              ) : shownTrips.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
                  <p className="text-3xl mb-2">🌍</p>
                  <p className="font-medium text-slate-800">{tripFilter === 'upcoming' ? 'No upcoming trips' : 'No trips here yet'}</p>
                  <p className="text-sm text-slate-500 mt-1">Flights, hotels, parcels and courier deliveries you book while signed in show up here.</p>
                  <div className="flex justify-center gap-2 mt-4">
                    <Link href="/?tab=flights" className="rounded-xl bg-sky-50 text-sky-700 px-4 py-2 text-sm font-semibold hover:bg-sky-100">✈️ Find a flight</Link>
                    <Link href="/?tab=hotels" className="rounded-xl bg-violet-50 text-violet-700 px-4 py-2 text-sm font-semibold hover:bg-violet-100">🏨 Find a hotel</Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-3">
                  {shownTrips.map(t => {
                    const [label, tint] = TRIP_STATUS[t.status] ?? [t.status, 'bg-slate-50 text-slate-600 ring-slate-200'];
                    return (
                      <li key={`${t.kind}-${t.id}`} className="flex flex-wrap sm:flex-nowrap items-center gap-4 rounded-xl border border-slate-100 p-4 hover:border-slate-200 hover:bg-slate-50/50 transition">
                        <span className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xl ${TRIP_ICON[t.kind][1]}`}>
                          {TRIP_ICON[t.kind][0]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {t.title}
                            {t.testBooking && <span className="ml-2 text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">test</span>}
                          </p>
                          <p className="text-sm text-slate-500">{fmtDate(t.start)}{t.end ? ` → ${fmtDate(t.end)}` : ''}</p>
                          <p className="text-xs text-slate-400 truncate">{t.subtitle}</p>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto justify-between">
                          <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ring-1 ${tint}`}>{label}</span>
                          <span className="text-sm font-bold text-slate-900">{fmtMoney(t.total, t.currency)}</span>
                          {t.receiptUrl && <Link href={t.receiptUrl} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View receipt →</Link>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Saved hotel bookings from the older checkout, still waiting for payment */}
            {pendingLocal.length > 0 && (
              <div className={`${card} p-5 sm:p-6`}>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Unfinished hotel bookings</h2>
                <p className="text-sm text-slate-500 mb-4">Saved on this device from an older version of Lyrtrip. Search the hotel again to book it.</p>
                <ul className="space-y-3">
                  {pendingLocal.map(b => (
                    <li key={b.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{b.hotelName}</p>
                        <p className="text-sm text-slate-500">{b.checkin || '—'} → {b.checkout || '—'} · {b.nights} night{b.nights > 1 ? 's' : ''} · {b.guests} guest{b.guests > 1 ? 's' : ''}</p>
                        <p className="text-sm font-bold text-slate-900">{fmtMoney(b.totalPrice)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href="/?tab=hotels" className="rounded-xl bg-btn px-4 py-2 text-sm font-semibold text-white hover:bg-btn-hover">Book again</Link>
                        <button onClick={() => handleCancelBooking(b.id)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tours */}
            {tours.length > 0 && (
              <div className={`${card} p-5 sm:p-6`}>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">My tours</h2>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {tours.slice(0, 6).map(t => (
                    <li key={t.id} className="rounded-xl border border-slate-100 p-4">
                      <p className="font-semibold text-slate-900 truncate">{t.title}</p>
                      {t.artist && <p className="text-sm text-slate-500 truncate">{t.artist}</p>}
                      <p className="text-xs text-slate-400 mt-1">{fmtDate(t.start_date)} → {fmtDate(t.end_date)}</p>
                      {t.status && <span className="inline-block mt-2 text-xs font-medium rounded-full bg-teal-50 text-teal-700 px-2 py-0.5 capitalize">{t.status.replace('-', ' ')}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Rewards */}
            <div className={`${card} p-5 sm:p-6 bg-linear-to-br from-white to-amber-50/60`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Rewards</h2>
                <Link href="/rewards" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Open →</Link>
              </div>
              {rewards ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-slate-900">{rewards.points.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">points · worth {fmtMoney(rewards.pointsValue)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${TIER_TINT[rewards.tier] ?? TIER_TINT.Member}`}>{rewards.tier}</span>
                  </div>
                  <div className="h-2 rounded-full bg-amber-100 mt-4 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${tierProgress}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {rewards.nextTier ? `${rewards.nextTier.pointsNeeded.toLocaleString()} points to ${rewards.nextTier.name}` : 'Top tier reached 🎉'}
                  </p>
                  <div className="mt-4 rounded-xl bg-white/80 border border-amber-100 p-3">
                    <p className="text-xs font-semibold text-slate-700">Invite friends, earn {rewards.referral.percent}%</p>
                    <div className="flex gap-2 mt-2">
                      <input readOnly value={rewards.referral.link} onFocus={e => e.target.select()}
                        className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-600" />
                      <button onClick={copyReferral} className="rounded-lg bg-btn px-3 py-1.5 text-xs font-semibold text-white hover:bg-btn-hover">
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-28 rounded-xl bg-amber-50/60 animate-pulse" />
              )}
            </div>

            {/* Courier */}
            <div className={`${card} p-5 sm:p-6 bg-linear-to-br from-white to-emerald-50/60`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-lg flex items-center justify-center">🛵</span>
                <h2 className="text-lg font-semibold text-slate-900">Send something today</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">A courier picks it up and delivers it across town, usually within the hour.</p>
              <Link href="/?tab=dash" className="block w-full text-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                Book a courier →
              </Link>
              <Link href="/?tab=shipping" className="block w-full text-center mt-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                📦 Ship a parcel further
              </Link>
            </div>

            {/* Help */}
            <div className={`${card} p-5 sm:p-6 bg-linear-to-br from-white to-sky-50/70`}>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Need help?</h2>
              <p className="text-sm text-slate-500 mb-3">Changes, refunds or questions about a booking.</p>
              <div className="flex flex-wrap gap-2">
                <a href="https://wa.me/16615809465" target="_blank" rel="noopener noreferrer"
                  className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 text-sm font-semibold hover:bg-emerald-100">WhatsApp</a>
                <a href="mailto:support@lyrtrip.com" className="rounded-xl bg-sky-50 text-sky-700 px-3 py-2 text-sm font-semibold hover:bg-sky-100">support@lyrtrip.com</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
