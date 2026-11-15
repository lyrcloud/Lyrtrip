'use client';

import { useState, type ReactNode } from 'react';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// A month calendar with arrows; each day's cell content comes from renderDay (prices, event names…)
export default function MonthGrid({ start, end, renderDay, months = 2, cellClass = 'min-h-14' }: {
  start: string; end: string; months?: 1 | 2; cellClass?: string;
  renderDay: (key: string, day: number) => ReactNode;
}) {
  const first = new Date(`${start}T00:00:00`);
  const [offset, setOffset] = useState(0);
  const shown = Array.from({ length: months }, (_, i) => new Date(first.getFullYear(), first.getMonth() + offset + i, 1));
  const canNext = dayKey(new Date(shown[shown.length - 1].getFullYear(), shown[shown.length - 1].getMonth() + 1, 1)) <= end;
  return (
    <div>
      <div className="mb-2 flex justify-end gap-1">
        <button onClick={() => setOffset(o => Math.max(0, o - 1))} disabled={offset === 0} aria-label="Previous month" className="h-8 w-8 rounded-full ring-1 ring-gray-200 disabled:opacity-30">‹</button>
        <button onClick={() => setOffset(o => o + 1)} disabled={!canNext} aria-label="Next month" className="h-8 w-8 rounded-full ring-1 ring-gray-200 disabled:opacity-30">›</button>
      </div>
      <div className={`grid gap-4 ${months === 2 ? 'md:grid-cols-2' : ''}`}>
        {shown.map((m, mi) => {
          const lead = (m.getDay() + 6) % 7;
          const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          return (
            <div key={mi} className={mi === 1 ? 'hidden md:block' : ''}>
              <p className="mb-2 text-center font-semibold text-gray-800">{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400">{WEEK.map(w => <span key={w}>{w}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const key = dayKey(new Date(m.getFullYear(), m.getMonth(), i + 1));
                  return <div key={key} className={cellClass}>{renderDay(key, i + 1)}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
