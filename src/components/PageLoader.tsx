'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { rememberReturnTo } from '@/lib/returnTo';

const button = 'px-4 py-2 rounded-xl text-sm font-semibold transition';

// Loading state for signed-in pages: a spinner that never spins forever. A failed load shows its message
// with Try again; a slow one offers a full reload after a few seconds; an expired sign-in offers Sign in again.
export default function PageLoader({ error, onRetry, returnTo }: { error: string | null; onRetry: () => void; returnTo: string }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (error) return;
    const t = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [error]);

  const signInAgain = async () => {
    rememberReturnTo(returnTo);
    await signOut();
    router.push('/login');
  };
  const expired = !!error && /sign in|sign-in|signed in/i.test(error);

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="text-center max-w-md space-y-4">
        {!error && <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />}
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {!error && slow && <p className="text-sm text-gray-600">This is taking longer than usual.</p>}
        {(error || slow) && (
          <div className="flex flex-wrap justify-center gap-2">
            {expired ? (
              <button onClick={signInAgain} className={`${button} bg-btn text-white hover:bg-btn-hover`}>Sign in again</button>
            ) : (
              <button onClick={onRetry} className={`${button} bg-btn text-white hover:bg-btn-hover`}>Try again</button>
            )}
            <button onClick={() => window.location.reload()} className={`${button} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`}>Reload page</button>
          </div>
        )}
      </div>
    </div>
  );
}
