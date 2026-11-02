'use client';

import { useState } from 'react';
import { getMyPlace } from '@/lib/myPlace';

/** "📍 Use my location" under a free-text place field: fills in the current address */
export default function NearMeButton({ onPick, as = 'address' }: { onPick: (place: string) => void; as?: 'address' | 'city' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      const p = await getMyPlace();
      onPick(as === 'city' ? p.city : p.address);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" onClick={pick} disabled={busy} className="mt-1 text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:text-gray-400">
        {busy ? 'Finding your location…' : '📍 Use my location'}
      </button>
      {error && <span className="block text-xs text-red-700">{error}</span>}
    </>
  );
}
