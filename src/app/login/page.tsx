'use client';

import { useEffect, useState } from 'react';
import { AuthForm } from '@/components/AuthForm';

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    // Read after mount (not via a lazy useState initializer) so the static
    // export's server-rendered markup (no `window`, always "signin") matches
    // the client's first render and React doesn't report a hydration mismatch.
    if (new URLSearchParams(window.location.search).get('mode') === 'signup') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('signup');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <AuthForm key={mode} mode={mode} />
        </div>
      </div>
    </div>
  );
}
