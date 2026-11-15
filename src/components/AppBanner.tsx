'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';

// The Android app's WebView appends this to its user agent (mobile/capacitor.config.json)
const inApp = () => /LyrtripApp/.test(navigator.userAgent);

const CLOSED_KEY = 'lyrtrip:appBarClosed';
const CLOSED_DAYS = 30;

// Read once in the browser; the server render (static export) never shows the bar
const noSubscribe = () => () => {};
function shouldOffer() {
  if (inApp() || !/Android/i.test(navigator.userAgent)) return false;
  try {
    const closed = Number(localStorage.getItem(CLOSED_KEY) || 0);
    if (closed && Date.now() - closed < CLOSED_DAYS * 86400000) return false;
  } catch { /* storage blocked: show the bar */ }
  return true;
}

/**
 * "Get the app" bar for Android browsers (not inside the app, not on /app). Closing it hides it for 30 days.
 */
export default function AppBanner() {
  const pathname = usePathname();
  const offer = useSyncExternalStore(noSubscribe, shouldOffer, () => false);
  const [closed, setClosed] = useState(false);

  if (!offer || closed || pathname === '/app') return null;

  const close = () => {
    setClosed(true);
    try { localStorage.setItem(CLOSED_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  return (
    <div role="region" aria-label="Lyrtrip app" className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2 text-sm md:hidden print:hidden">
      <button type="button" onClick={close} aria-label="Close" className="px-1 text-xl leading-none text-gray-400 hover:text-gray-700">&times;</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={36} height={36} className="rounded-lg border border-gray-200" />
      <div className="flex-1 min-w-0 leading-tight">
        <strong className="block text-gray-900">Lyrtrip app</strong>
        <span className="text-gray-500">Faster booking on Android</span>
      </div>
      <Link href="/app" className="rounded-full bg-brand-600 px-4 py-1.5 font-semibold text-white hover:bg-brand-700">Get</Link>
    </div>
  );
}

/** On /app: tells people already in the app that they have it */
export function AlreadyInApp() {
  const show = useSyncExternalStore(noSubscribe, inApp, () => false);
  return show ? <p className="mt-4 font-semibold text-gray-900">You&apos;re already using the Lyrtrip app.</p> : null;
}
