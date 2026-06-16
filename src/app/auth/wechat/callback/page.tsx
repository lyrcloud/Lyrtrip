'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { completeWeChatSignIn } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';

export default function WeChatCallbackPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code || !state) {
      setError('Missing WeChat authorization code.');
      return;
    }

    (async () => {
      const { error } = await completeWeChatSignIn(code, state);
      if (error) {
        setError(error.message);
        return;
      }
      await refresh();
      router.replace('/dashboard');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900">WeChat sign-in failed</h1>
          <p className="text-sm text-gray-600">{error}</p>
          <Link href="/login" className="inline-block text-indigo-600 hover:text-indigo-700 font-medium">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-green-200 border-t-green-600" />
        <p className="text-sm text-gray-600">Finishing WeChat sign-in…</p>
      </div>
    </div>
  );
}
