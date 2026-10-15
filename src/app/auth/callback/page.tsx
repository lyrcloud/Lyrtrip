'use client';

import { useEffect, useState } from 'react';
import { takeReturnTo } from '@/lib/returnTo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { completeFederatedSignIn } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const oauthError = params.get('error_description') || params.get('error');

    if (oauthError) {
      setError(oauthError);
      return;
    }

    if (!code) {
      setError('Missing authorization code.');
      return;
    }

    (async () => {
      const { error } = await completeFederatedSignIn(code);
      if (error) {
        setError(error.message);
        return;
      }
      await refresh();
      const hasPending = !!sessionStorage.getItem('lyrtrip_pending_booking');
      router.replace(hasPending ? '/?booking=pending' : takeReturnTo());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Sign-in failed</h1>
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
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        <p className="text-sm text-gray-600">Finishing sign-in…</p>
      </div>
    </div>
  );
}
