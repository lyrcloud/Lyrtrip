'use client';

import { useState } from 'react';

// Weekly job or study match emails, on or off
export default function DigestToggle({ initiallyOn, kind, save }: { initiallyOn: boolean; kind: 'job' | 'study'; save: (on: boolean) => Promise<unknown> }) {
  const [on, setOn] = useState(initiallyOn);
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    try { await save(!on); setOn(!on); } catch (err) { alert(err instanceof Error ? err.message : 'Could not save'); }
    setBusy(false);
  };
  return (
    <label className="flex items-start gap-3 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 text-sm cursor-pointer">
      <input type="checkbox" checked={on} disabled={busy} onChange={flip} className="mt-0.5" />
      <span>
        <span className="font-semibold text-gray-900">Weekly {kind} matches by email</span>
        <span className="block text-gray-600">
          {kind === 'job' ? 'Good-fit jobs for the roles and city in your profile, ready to apply through Lyrtrip.' : 'Admissions and scholarships for the level, subject and countries in your profile.'}
        </span>
      </span>
    </label>
  );
}
