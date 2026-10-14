'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import InteractiveLogo from '@/components/InteractiveLogo';
import { useAuth } from '@/context/AuthContext';
import LocalePicker from '@/components/LocalePicker';
import { useLocale } from '@/i18n/LocaleContext';

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

/**
 * Navigation component with Lyrtrip logo and auth-aware actions
 */
export default function Navigation() {
  const { user, loading, signOut } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push('/');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 print:hidden">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo */}
          <InteractiveLogo />

          {/* Navigation Links */}
          <div className="flex items-center gap-3 sm:gap-6">
            <LocalePicker />
            {loading ? (
              <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
            ) : user ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(open => !open)}
                  className="flex items-center gap-2 rounded-full border border-gray-200 pl-1 pr-3 py-1 hover:bg-gray-50 transition-colors"
                >
                  {user.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.picture} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-btn text-white text-xs font-semibold flex items-center justify-center">
                      {initialsFor(user.name, user.email)}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-700 max-w-30 truncate">
                    {user.name || user.email}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute end-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {t('Dashboard')}
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-start px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      {t('Sign out')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg bg-btn py-2 pl-3 pr-4 font-medium text-white shadow-md shadow-btn/25 transition-all duration-200 animate-[signInIn_400ms_ease-out] hover:bg-btn-hover hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
              >
                {/* Light sweep that repeats every few seconds */}
                <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/30 animate-[signInShine_4s_ease-in-out_infinite]" />
                <svg
                  aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  className="relative h-5 w-5 transition-transform duration-300 group-hover:animate-[signInWave_600ms_ease-in-out]"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
                <span className="relative">{t('Sign In')}</span>
                <svg
                  aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
                  className="relative -ml-1 h-4 w-0 opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:w-4 group-hover:opacity-100 group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
