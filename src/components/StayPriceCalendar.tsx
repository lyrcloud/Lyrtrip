'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import MonthGrid from './MonthGrid';

interface NightPrice { date: string; price: number }

// Cheapest night for every check-in date at one stay over the next two months; picking a date books from it
export default function StayPriceCalendar({ name, propertyToken, onPick, onClose }: {
  name: string; propertyToken: string; onPick: (checkin: string) => void; onClose: () => void;
}) {
  const { t, money } = useLocale();
  const [data, setData] = useState<{ prices: NightPrice[]; cheapest: NightPrice | null; start: string; end: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
        const res = await fetch(`${base}/api/hotel/calendar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyToken }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'Could not load prices');
        setData(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load prices');
      }
    })();
  }, [propertyToken]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const byDay = new Map((data?.prices ?? []).map(p => [p.date, p.price]));
  const ps = data?.prices.map(p => p.price) ?? [];
  const lo = ps.length ? Math.min(...ps) : 0;
  const hi = ps.length ? Math.max(...ps) : 0;
  const tone = (p: number) => { const r = hi > lo ? (p - lo) / (hi - lo) : 0; return r < 0.2 ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : r < 0.55 ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-rose-50 text-rose-800 ring-rose-200'; };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-brand-600">{t('Cheapest nights')}</p>
            <h2 className="font-bold text-gray-900">{name}</h2>
            {data?.cheapest && <p className="text-sm text-emerald-700">{t('Lowest')}: <b>{money(data.cheapest.price)}</b> {t('on')} {new Date(`${data.cheapest.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-xl text-gray-400 hover:text-gray-700">×</button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data && !error && <div className="flex justify-center py-10"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>}
        {data && data.prices.length === 0 && <p className="text-sm text-gray-600">{t('No nightly prices are listed for this stay yet.')}</p>}
        {data && data.prices.length > 0 && (
          <MonthGrid start={data.prices[0].date} end={data.prices[data.prices.length - 1].date} renderDay={(key, day) => {
            const p = byDay.get(key);
            return (
              <button disabled={!p} onClick={() => p && onPick(key)} title={p ? `${key}: ${money(p)}` : key}
                className={`relative flex h-14 w-full flex-col items-center justify-center rounded-lg text-xs ring-1 transition ${p ? `${tone(p)} hover:scale-105 hover:shadow` : 'cursor-default bg-gray-50 text-gray-300 ring-gray-100'}`}>
                <span className="font-semibold">{day}</span>
                {p && <span className="text-[10px] font-bold leading-tight">{money(p).replace(/\.\d+$/, '')}</span>}
                {p && data.cheapest?.date === key && <span className="absolute -top-1.5 rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">{t('Low')}</span>}
              </button>
            );
          }} />
        )}
        <p className="mt-3 text-[11px] text-gray-500">{t('One-night prices by check-in date. Pick a date to book from it.')}</p>
      </div>
    </div>
  );
}
