'use client';

import { useEffect } from 'react';
import { isStaleBuildError, reloadForNewBuild, reportClientError } from '@/lib/staleBuild';

// The whole app failed (the root layout included), so this renders its own page
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error(error);
    if (!(isStaleBuildError(error) && reloadForNewBuild())) reportClientError(error, 'global');
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Arial, sans-serif', textAlign: 'center', padding: '64px 16px', color: '#111' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Lyrtrip needs a reload</h1>
        <p style={{ color: '#555', marginBottom: 24 }}>Lyrtrip was just updated, or something went wrong.</p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', borderRadius: 12, border: 0, background: '#111', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Reload
        </button>
        <pre style={{ marginTop: 32, fontSize: 11, color: '#777', whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: 560, marginInline: 'auto' }}>{`${error.name}: ${error.message}`}</pre>
      </body>
    </html>
  );
}
