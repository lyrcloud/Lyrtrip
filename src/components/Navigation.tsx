'use client';

import Image from 'next/image';
import Link from 'next/link';

/**
 * Navigation component with Lyrtrip logo
 */
export default function Navigation() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="Lyrtrip logo"
              width={40}
              height={40}
              className="w-10 h-10"
            />
            <span className="text-xl font-bold text-gray-900">Lyrtrip</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <Link
              href="/tours"
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Tours
            </Link>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              Sign In
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
