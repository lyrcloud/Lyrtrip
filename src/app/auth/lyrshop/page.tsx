'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { completeLyrshopSignIn } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { takeReturnTo } from '@/lib/returnTo';

// Back from Lyrshop: /auth/lyrshop#token=<handoff>&state=<state>
export default function LyrshopCallbackPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    const state = params.get('state');
    window.history.replaceState(null, '', window.location.pathname);

    if (!token || !state) {
      setError('Missing Lyrshop sign-in details.');
      return;
    }

    (async () => {
      const { error } = await completeLyrshopSignIn(token, state);
      if (error) {
        setError(error.message);
        return;
      }
      await refresh();
      router.replace(takeReturnTo());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Lyrshop sign-in failed</h1>
          <p className="text-sm text-gray-600">{error}</p>
          <Link href="/login" className="inline-block text-brand-600 hover:text-brand-700 font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-green-200 border-t-green-600" />
        <p className="text-sm text-gray-600">Finishing Lyrshop sign-in…</p>
      </div>
    </div>
  );
}
