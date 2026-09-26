'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UberCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const err  = params.get('error');

    if (err) { setError(err); return; }
    if (!code) { setError('Missing authorization code.'); return; }

    const redirectUri = `${window.location.origin}/auth/uber/callback`;
    const lambdaBase  = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');

    (async () => {
      try {
        const res  = await fetch(`${lambdaBase}/api/uber/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Token exchange failed');
        localStorage.setItem('uber_access_token', data.access_token);
        if (data.expires_in) {
          localStorage.setItem('uber_token_expires', String(Date.now() + data.expires_in * 1000));
        }
        router.replace('/?tab=dash');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Authentication failed');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-gray-900 font-semibold mb-2">Uber connection failed</p>
        <p className="text-red-600 text-sm mb-6">{error}</p>
        <a href="/" className="px-5 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition">
          Return home
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-black border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-600 text-sm">Connecting your Uber account…</p>
      </div>
    </div>
  );
}
