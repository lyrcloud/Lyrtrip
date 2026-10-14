'use client';

import { useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';

interface Offer {
  source: string;
  link: string | null;
  logo: string | null;
  official: boolean;
  nightly: number | null;
  total: number | null;
  freeCancellation: boolean;
}

/** "Compare prices": the same room on other booking sites (Google Hotels), cheapest first. */
export default function HotelPriceCompare({ propertyToken, destination, checkin, checkout, adults, lyrtripTotal }: {
  propertyToken: string;
  destination: string;
  checkin: string;
  checkout: string;
  adults: number;
  lyrtripTotal: number | null;
}) {
  const { t, money } = useLocale();
  const [state, setState] = useState<{ key: string; offers?: Offer[]; error?: string; loading?: boolean } | null>(null);
  const key = `${propertyToken}|${checkin}|${checkout}|${adults}`;
  const current = state?.key === key ? state : null;

  const load = async () => {
    setState({ key, loading: true });
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/hotel/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyToken, destination, checkin, checkout, adults }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('Could not load prices from other sites. Try again in a moment.'));
      setState({ key, offers: data.offers ?? [] });
    } catch (err) {
      setState({ key, error: (err as Error).message });
    }
  };

  if (!checkin || !checkout) return null;

  if (!current) {
    return (
      <button type="button" onClick={load} className="w-full mb-4 px-4 py-2 rounded-lg border border-brand-200 bg-white text-sm font-semibold text-brand-700 hover:bg-brand-50">
        {t('Compare prices on other sites')}
      </button>
    );
  }

  const offers = current.offers ?? [];
  const cheapest = offers[0];
  const amount = (o: Offer) => o.total ?? o.nightly ?? 0;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-2">{t('Same room on other sites')}</p>
      {current.loading && <p className="text-gray-500">{t('Checking other sites…')}</p>}
      {current.error && <p className="text-red-700">{current.error}</p>}
      {!current.loading && !current.error && offers.length === 0 && <p className="text-gray-500">{t('No other sites list this room for these dates.')}</p>}
      {offers.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {offers.slice(0, 8).map(o => (
            <li key={o.source} className="flex items-center justify-between gap-3 py-1.5">
              <span className="flex items-center gap-2 min-w-0">
                {o.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.logo} alt="" className="w-5 h-5 rounded object-contain shrink-0" />
                )}
                <span className="truncate text-gray-800">{o.source}</span>
                {o === cheapest && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">{t('Lowest')}</span>}
                {o.freeCancellation && <span className="shrink-0 text-[10px] text-green-700">{t('Free cancellation')}</span>}
              </span>
              <span className="shrink-0 text-end">
                {o.link ? (
                  <a href={o.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">{money(amount(o))}</a>
                ) : (
                  <span className="font-semibold text-gray-900">{money(amount(o))}</span>
                )}
                <span className="block text-[10px] text-gray-400">{o.total != null ? t('total stay') : t('per night')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {lyrtripTotal != null && cheapest?.total != null && (
        <p className="mt-2 text-xs text-gray-500">
          {t('Lyrtrip total {lyrtrip} includes our 12% booking service; we book directly with the hotel and refund in full if it cannot confirm.', { lyrtrip: money(lyrtripTotal) })}
        </p>
      )}
    </div>
  );
}
