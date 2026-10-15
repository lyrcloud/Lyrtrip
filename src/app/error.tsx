'use client';

import { useEffect } from 'react';
import { isStaleBuildError, reloadForNewBuild } from '@/lib/staleBuild';

// A page failed: reload into the new build when that's the cause, otherwise offer a retry instead of a blank screen
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    if (isStaleBuildError(error)) reloadForNewBuild();
  }, [error]);
  return (
    <div className="flex-1 bg-gray-50 py-16 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-600 mb-6">Please try again. If it keeps happening, reload the page.</p>
      <div className="flex justify-center gap-3">
        <button onClick={reset} className="px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover">Try again</button>
        <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-white text-gray-700 rounded-xl font-semibold ring-1 ring-gray-200">Reload</button>
      </div>
    </div>
  );
}
