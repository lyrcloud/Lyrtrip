'use client';

import { useMemo, useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

interface DayFare { date: string; returnDate: string | null; price: number; low: boolean }
interface CalendarReply { from: string; to: string; round: boolean; tripDays: number; prices: DayFare[]; cheapest: DayFare | null; error?: string }

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Trip.com-style low-fare calendar: the cheapest fare for each day of the next weeks, coloured from cheap
// (green) to dear (red). Picking a day fills in the departure (and return) date for the search.
export default function FareCalendar({ from, to, round, tripDays, adults, selected, onPick }: {
  from: string; to: string; round: boolean; tripDays: number; adults: number; selected: string; onPick: (depart: string, ret: string | null) => void;
}) {
  const { t, money } = useLocale();
  const [data, setData] = useState<CalendarReply | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
      const res = await fetch(`${base}/api/flight/calendar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, tripType: round ? 'round' : 'oneway', tripDays, adults }),
      });
      const d = await res.json() as CalendarReply;
      if (!res.ok) throw new Error(d.error || 'Could not load fares');
      setData(d);
      setMonthOffset(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load fares');
    }
    setLoading(false);
  };

  const byDay = useMemo(() => new Map((data?.prices ?? []).map(p => [p.date, p])), [data]);
  const [lo, hi] = useMemo(() => {
    const ps = (data?.prices ?? []).map(p => p.price);
    return ps.length ? [Math.min(...ps), Math.max(...ps)] : [0, 0];
  }, [data]);
  const tone = (price: number) => {
    const r = hi > lo ? (price - lo) / (hi - lo) : 0;
    return r < 0.2 ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : r < 0.55 ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-rose-50 text-rose-800 ring-rose-200';
  };

  const ready = from.trim().length > 1 && to.trim().length > 1;
  if (!data) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-4">
        <span className="text-2xl" aria-hidden>📅</span>
        <div className="flex-1 min-w-[12rem]">
          <p className="font-semibold text-gray-900">{t('Cheapest dates calendar')}</p>
          <p className="text-sm text-gray-600">{t('See the lowest fare for every day of the next weeks and pick the cheapest.')}</p>
        </div>
        <button onClick={load} disabled={!ready || loading} className="px-4 py-2 rounded-xl bg-btn text-white text-sm font-semibold hover:bg-btn-hover disabled:bg-gray-300">
          {loading ? t('Loading fares…') : ready ? t('Show cheapest dates') : t('Choose from and to first')}
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Two months side by side (one on phones), starting from the first month that has fares
  const first = data.prices[0] ? new Date(`${data.prices[0].date}T00:00:00`) : new Date();
  const months = [0, 1].map(i => new Date(first.getFullYear(), first.getMonth() + monthOffset + i, 1));
  const lastFare = data.prices.at(-1)?.date ?? '';
  const canNext = dayKey(new Date(months[1].getFullYear(), months[1].getMonth() + 1, 1)) <= lastFare;

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-gray-900">{t('Cheapest dates')}: {data.from} → {data.to}{data.round ? ` · ${t('round trip')}, ${data.tripDays} ${t('days')}` : ` · ${t('one way')}`}</p>
          {data.cheapest && (
            <p className="text-sm text-emerald-700">{t('Lowest')}: <b>{money(data.cheapest.price)}</b> {t('on')} {new Date(`${data.cheapest.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              <button onClick={() => onPick(data.cheapest!.date, data.cheapest!.returnDate)} className="ml-2 underline font-semibold">{t('Use this date')}</button>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthOffset(m => Math.max(0, m - 1))} disabled={monthOffset === 0} aria-label={t('Previous month')} className="h-8 w-8 rounded-full ring-1 ring-gray-200 disabled:opacity-30">‹</button>
          <button onClick={() => setMonthOffset(m => m + 1)} disabled={!canNext} aria-label={t('Next month')} className="h-8 w-8 rounded-full ring-1 ring-gray-200 disabled:opacity-30">›</button>
          <button onClick={load} className="ml-1 text-xs text-gray-500 underline">{t('Refresh')}</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {months.map((m, mi) => {
          const lead = (m.getDay() + 6) % 7;
          const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          return (
            <div key={mi} className={mi === 1 ? 'hidden md:block' : ''}>
              <p className="text-center font-semibold text-gray-800 mb-2">{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-gray-400 mb-1">{WEEK.map(w => <span key={w}>{t(w)}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: lead }).map((_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: days }).map((_, i) => {
                  const key = dayKey(new Date(m.getFullYear(), m.getMonth(), i + 1));
                  const fare = byDay.get(key);
                  const isSel = key === selected;
                  const isLow = fare && data.cheapest && fare.price === data.cheapest.price;
                  return (
                    <button key={key} disabled={!fare} onClick={() => fare && onPick(fare.date, fare.returnDate)}
                      title={fare ? `${key}: ${money(fare.price)}` : key}
                      className={`relative flex h-14 flex-col items-center justify-center rounded-lg text-xs ring-1 transition ${
                        fare ? `${tone(fare.price)} hover:scale-105 hover:shadow` : 'bg-gray-50 text-gray-300 ring-gray-100 cursor-default'} ${isSel ? '!ring-2 !ring-gray-900' : ''}`}>
                      <span className="font-semibold">{i + 1}</span>
                      {fare && <span className="text-[10px] font-bold leading-tight">{money(fare.price).replace(/\.\d+$/, '')}</span>}
                      {isLow && <span className="absolute -top-1.5 rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">{t('Low')}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-gray-500">{t('Lowest fares found per day, including Lyrtrip\'s fee. The exact price is confirmed when you search that date.')}</p>
    </div>
  );
}
