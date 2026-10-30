'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/i18n/LocaleContext';
import { getNavTab, requestNavTab, subscribeNavTab } from '@/lib/navTab';

interface Service {
  tab: string;
  icon: string;
  label: string;
  /** Home page tabs that light this entry up */
  tabs: string[];
  /** Pages of their own that light this entry up */
  paths?: string[];
}

// Every service on the home page, in the order trip.com-style panels list them (most booked first)
const services = (t: (text: string) => string): Service[] => [
  { tab: 'flights', icon: '✈️', label: t('Flights'), tabs: ['flights'] },
  { tab: 'hotels', icon: '🏨', label: t('Hotels'), tabs: ['hotels'] },
  { tab: 'car', icon: '🚗', label: t('Rides'), tabs: ['car', 'taxi', 'limo', 'motorcycle', 'bike', 'ebike', 'scooter', 'ambulance'] },
  { tab: 'train', icon: '🚂', label: t('Trains'), tabs: ['train'] },
  { tab: 'bus', icon: '🚌', label: t('Buses'), tabs: ['bus'] },
  { tab: 'cruise', icon: '🚢', label: t('Cruises'), tabs: ['cruise'] },
  { tab: 'helicopter', icon: '🚁', label: t('Air charters'), tabs: ['helicopter', 'seaplane', 'airambulance'], paths: ['/helicopter'] },
  { tab: 'tourism', icon: '🎒', label: t('Tours'), tabs: ['tourism'], paths: ['/tours'] },
  { tab: 'events', icon: '🎟️', label: t('Events'), tabs: ['events'], paths: ['/events'] },
  { tab: 'food', icon: '🍱', label: t('Food delivery'), tabs: ['food'] },
  { tab: 'dash', icon: '🛵', label: t('Courier'), tabs: ['dash'], paths: ['/dash'] },
  { tab: 'shipping', icon: '📦', label: t('Shipment'), tabs: ['shipping'] },
  { tab: 'truck', icon: '🚚', label: t('Freight'), tabs: ['truck', 'freight'], paths: ['/freight'] },
  { tab: 'study', icon: '🎓', label: t('Study'), tabs: ['study'], paths: ['/study'] },
  { tab: 'career', icon: '💼', label: t('Jobs'), tabs: ['career'], paths: ['/jobs', '/talent'] },
  { tab: 'tax', icon: '⚖️', label: t('Tax & Legal'), tabs: ['tax', 'legal', 'lawyer'], paths: ['/legal'] },
  { tab: 'charity', icon: '🤲', label: t('Charity'), tabs: ['charity'], paths: ['/donate'] },
];

const accountLinks = (t: (text: string) => string) => [
  { href: '/dashboard', icon: '🧳', label: t('My trips') },
  { href: '/rewards', icon: '🎁', label: t('Rewards & gift cards') },
  { href: '/jobs/profile', icon: '🪪', label: t('Job profile') },
];

const RAIL_KEY = 'lyrtrip:rail';
const railListeners = new Set<() => void>();
const subscribeRail = (listener: () => void) => {
  railListeners.add(listener);
  return () => { railListeners.delete(listener); };
};

const startsWith = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

function useActiveService(list: Service[]) {
  const pathname = usePathname();
  const tab = useSyncExternalStore(subscribeNavTab, getNavTab, () => null);
  if (pathname === '/') return list.find(s => tab && s.tabs.includes(tab)) ?? null;
  return list.find(s => s.paths?.some(p => startsWith(pathname, p))) ?? null;
}

// Opens a home page tab: in place when the home page is showing, otherwise by loading /?tab=
function useOpenService() {
  const pathname = usePathname();
  return (e: React.MouseEvent, tab: string) => {
    if (pathname !== '/') return;
    e.preventDefault();
    requestNavTab(tab);
  };
}

function Icon({ name }: { name: 'home' | 'grid' | 'trips' | 'gift' | 'user' }) {
  const paths = {
    home: <path d="M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5" />,
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>,
    trips: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
    gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8C10 4 6 4 6 6.5S10 8 12 8c2 0 6 1 6-1.5S14 4 12 8" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  };
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
      {paths[name]}
    </svg>
  );
}

/**
 * trip.com-style panel down the left edge on tablets and computers, for signed-in visitors: every service, then the account pages.
 * Computers get icons with labels (collapsible to a slim rail); tablets get the slim rail.
 */
export function SideNav() {
  const { t } = useLocale();
  const { user } = useAuth();
  const pathname = usePathname();
  const serviceItems = services(t);
  const accountItems = accountLinks(t);
  const active = useActiveService(serviceItems);
  const openService = useOpenService();
  // The page makes room for the panel only while someone is signed in
  useEffect(() => {
    if (user) document.documentElement.dataset.auth = 'in';
    else delete document.documentElement.dataset.auth;
  }, [user]);

  // The layout's head script sets html[data-rail] from localStorage before the first paint
  const slim = useSyncExternalStore(subscribeRail, () => document.documentElement.dataset.rail === 'slim', () => false);

  const toggle = () => {
    const next = !slim;
    if (next) document.documentElement.dataset.rail = 'slim';
    else delete document.documentElement.dataset.rail;
    try { localStorage.setItem(RAIL_KEY, next ? 'slim' : 'wide'); } catch { /* private mode */ }
    railListeners.forEach(listener => listener());
  };

  if (!user) return null;

  const item = (current: boolean) => `group relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-center text-[0.66rem] leading-tight transition-colors rail-wide:flex-row rail-wide:gap-3 rail-wide:px-3 rail-wide:py-2 rail-wide:text-start rail-wide:text-sm ${
    current ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`;
  const bar = (current: boolean) => current
    ? <span aria-hidden className="absolute inset-y-2 -start-2 w-1 rounded-e-full bg-brand-600" />
    : null;
  const heading = (text: string) => (
    <p className="hidden px-3 pb-1 pt-3 text-[0.7rem] font-bold uppercase tracking-wider text-gray-400 rail-wide:block">{text}</p>
  );

  return (
    <aside className="fixed bottom-0 start-0 top-18 z-30 hidden w-[var(--rail-w)] flex-col border-e border-gray-200 bg-white transition-[width] duration-200 md:flex print:hidden">
      <nav aria-label={t('Services')} className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3 [scrollbar-width:thin]">
        {heading(t('Book'))}
        <div className="flex flex-col gap-0.5 pt-2 rail-wide:pt-0">
          {serviceItems.map(s => {
            const current = active?.tab === s.tab;
            return (
              <Link
                key={s.tab}
                href={`/?tab=${s.tab}`}
                onClick={e => openService(e, s.tab)}
                aria-current={current ? 'page' : undefined}
                title={s.label}
                className={item(current)}
              >
                {bar(current)}
                <span aria-hidden className="text-xl leading-none transition-transform group-hover:scale-110 rail-wide:text-lg">{s.icon}</span>
                <span className="max-w-full truncate">{s.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="my-2 border-t border-gray-100" />
        {heading(t('My Lyrtrip'))}
        <div className="flex flex-col gap-0.5">
          {accountItems.map(link => {
            const current = startsWith(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                title={link.label}
                className={item(current)}
              >
                {bar(current)}
                <span aria-hidden className="text-xl leading-none transition-transform group-hover:scale-110 rail-wide:text-lg">{link.icon}</span>
                <span className="max-w-full truncate">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={slim ? t('Expand menu') : t('Collapse menu')}
        title={slim ? t('Expand menu') : t('Collapse menu')}
        className="hidden items-center gap-2 border-t border-gray-100 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 lg:flex"
      >
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 transition-transform rtl:-scale-x-100 ${slim ? 'rotate-180' : ''}`}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        <span className="hidden rail-wide:inline">{t('Collapse menu')}</span>
      </button>
    </aside>
  );
}

/**
 * App-style bar fixed to the bottom of phones (and the Android app): Home, Explore (every service in a sheet),
 * Trips, Rewards and Account.
 */
export function BottomNav() {
  const { t } = useLocale();
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const serviceItems = services(t);
  const accountItems = accountLinks(t);
  const active = useActiveService(serviceItems);
  const openService = useOpenService();
  const [sheet, setSheet] = useState<'explore' | 'account' | null>(null);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheet]);

  const handleSignOut = async () => {
    setSheet(null);
    await signOut();
    router.push('/');
  };

  const onHome = pathname === '/';
  const tabClass = (current: boolean) => `relative flex min-w-0 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-semibold transition-colors active:bg-gray-50 ${
    current ? 'text-brand-600' : 'text-gray-500'}`;
  const topBar = (current: boolean) => current
    ? <span aria-hidden className="absolute inset-x-[28%] top-0 h-[3px] rounded-b-full bg-brand-600" />
    : null;
  const label = (text: string) => <span className="max-w-full truncate px-0.5">{text}</span>;

  const isCurrent = {
    home: onHome && !sheet,
    explore: sheet === 'explore' || (!onHome && !!active),
    trips: !sheet && startsWith(pathname, '/dashboard'),
    rewards: !sheet && startsWith(pathname, '/rewards'),
    account: sheet === 'account' || (!sheet && (startsWith(pathname, '/login') || startsWith(pathname, '/jobs/profile'))),
  };

  return (
    <>
      {sheet && (
        <div className="fixed inset-x-0 top-0 bottom-[var(--bottom-bar-h)] z-[45] md:hidden print:hidden" onClick={() => setSheet(null)}>
          <div className="absolute inset-0 bg-black/30 animate-[fadeIn_150ms_ease-out]" />
          <div
            role="dialog"
            aria-label={sheet === 'explore' ? t('All services') : t('Account')}
            onClick={e => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[calc(100dvh-var(--bottom-bar-h)-5rem)] overflow-y-auto rounded-t-3xl bg-white px-4 pb-5 pt-3 shadow-2xl animate-[sheetUp_220ms_ease-out]"
          >
            <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" />
            {sheet === 'explore' ? (
              <>
                <p className="mb-3 text-base font-bold text-gray-900">{t('All services')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {serviceItems.map(s => {
                    const current = active?.tab === s.tab;
                    return (
                      <Link
                        key={s.tab}
                        href={`/?tab=${s.tab}`}
                        onClick={e => { openService(e, s.tab); setSheet(null); }}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center text-xs font-medium leading-tight ${
                          current ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-gray-700 active:bg-gray-50'}`}
                      >
                        <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-2xl">{s.icon}</span>
                        {s.label}
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-3">
                  {user?.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.picture} alt="" className="h-11 w-11 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-btn text-white"><Icon name="user" /></span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold text-gray-900">{user?.name || t('Account')}</p>
                    {user?.email && <p className="truncate text-sm text-gray-500">{user.email}</p>}
                  </div>
                </div>
                <div className="flex flex-col divide-y divide-gray-100 rounded-2xl ring-1 ring-gray-100">
                  {accountItems.map(link => (
                    <Link key={link.href} href={link.href} onClick={() => setSheet(null)} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-800 active:bg-gray-50">
                      <span aria-hidden className="text-xl">{link.icon}</span>{link.label}
                    </Link>
                  ))}
                  <button type="button" onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3.5 text-start text-sm font-medium text-red-600 active:bg-red-50">
                    <span aria-hidden className="text-xl">🚪</span>{t('Sign out')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <nav
        aria-label={t('Shortcuts')}
        className="fixed inset-x-0 bottom-0 z-40 grid h-[var(--bottom-bar-h)] grid-cols-5 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgba(17,24,39,0.08)] backdrop-blur md:hidden print:hidden"
      >
        <Link
          href="/"
          onClick={e => { setSheet(null); if (onHome) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}
          aria-current={isCurrent.home ? 'page' : undefined}
          className={tabClass(isCurrent.home)}
        >
          {topBar(isCurrent.home)}<Icon name="home" />{label(t('Home'))}
        </Link>
        <button type="button" onClick={() => setSheet(s => (s === 'explore' ? null : 'explore'))} aria-expanded={sheet === 'explore'} className={tabClass(isCurrent.explore)}>
          {topBar(isCurrent.explore)}<Icon name="grid" />{label(t('Explore'))}
        </button>
        <Link href={user ? '/dashboard' : '/login'} aria-current={isCurrent.trips ? 'page' : undefined} className={tabClass(isCurrent.trips)}>
          {topBar(isCurrent.trips)}<Icon name="trips" />{label(t('Trips'))}
        </Link>
        <Link href={user ? '/rewards' : '/login'} aria-current={isCurrent.rewards ? 'page' : undefined} className={tabClass(isCurrent.rewards)}>
          {topBar(isCurrent.rewards)}<Icon name="gift" />{label(t('Rewards'))}
        </Link>
        {user ? (
          <button type="button" onClick={() => setSheet(s => (s === 'account' ? null : 'account'))} aria-expanded={sheet === 'account'} className={tabClass(isCurrent.account)}>
            {topBar(isCurrent.account)}
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" className={`h-6 w-6 rounded-full object-cover ${isCurrent.account ? 'ring-2 ring-brand-500' : ''}`} />
            ) : <Icon name="user" />}
            {label(t('Account'))}
          </button>
        ) : (
          <Link href="/login" aria-current={isCurrent.account ? 'page' : undefined} className={tabClass(isCurrent.account)}>
            {topBar(isCurrent.account)}<Icon name="user" />{label(t('Sign In'))}
          </Link>
        )}
      </nav>
    </>
  );
}
