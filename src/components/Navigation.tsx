'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push('/');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 print:hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="Lyrtrip"
              width={140}
              height={48}
              priority
              className="h-10 w-auto object-contain"
            />
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
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
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">
                      {initialsFor(user.name, user.email)}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-700 max-w-30 truncate">
                    {user.name || user.email}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Dashboard
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
