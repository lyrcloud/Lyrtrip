'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { lyrshopHandoffUrl } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { rememberReturnTo } from '@/lib/returnTo';

const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

// Lyrshop asking who's signed in here: /connect?app=lyrshop&state=<state>
export default function ConnectPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [state, setState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('state') ?? '';
    if (params.get('app') !== 'lyrshop' || !STATE_PATTERN.test(value)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("This sign-in link isn't valid. Start again from Lyrshop.");
      return;
    }
    setState(value);
  }, []);

  useEffect(() => {
    if (!state || loading || user) return;
    // Sign in here first, then come back to finish.
    rememberReturnTo(`/connect?app=lyrshop&state=${encodeURIComponent(state)}`);
    router.replace('/login');
  }, [state, loading, user, router]);

  const proceed = async () => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      window.location.href = await lyrshopHandoffUrl(state);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const switchAccount = async () => {
    await signOut();
  };

  return (
    <div className="flex-1 bg-gradient-to-br from-brand-50 via-white to-brand-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-4 text-center">
        <h1 className="text-xl font-bold text-gray-900">Continue to Lyrshop</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {user && state && (
          <>
            <p className="text-sm text-gray-600">
              Lyrshop would like to sign you in as {user.name || user.email || user.phone} ({user.email || user.phone}).
            </p>
            <button
              type="button"
              onClick={proceed}
              disabled={busy}
              className="w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Taking you to Lyrshop…' : 'Continue to Lyrshop'}
            </button>
            <button type="button" onClick={switchAccount} className="w-full text-sm text-brand-600 hover:text-brand-700">
              Use another Lyrtrip account
            </button>
          </>
        )}
        {!user && !error && <p className="text-sm text-gray-600">Checking your Lyrtrip sign-in…</p>}
        <Link href="/" className="block text-sm text-gray-500 hover:text-gray-700">Back to Lyrtrip</Link>
      </div>
    </div>
  );
}
