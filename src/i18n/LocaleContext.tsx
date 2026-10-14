'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import CATALOG from './strings.json';
import { COUNTRY_CURRENCY, LANGUAGE_DEFAULT_COUNTRY, RTL_LANGUAGES } from './regions';

// Worldwide visitors: the site picks the browser's language and the local currency on the first
// visit; both can be changed from the picker and are remembered. English strings are the keys
// (see scripts/extract-i18n.mjs); other languages come from /api/i18n, cached per browser.

const LANG_KEY = 'lyrtrip:lang';
const CURRENCY_KEY = 'lyrtrip:currency';
const DICT_PREFIX = 'lyrtrip:i18n:';
const RATES_KEY = 'lyrtrip:rates';
const RATES_MAX_AGE_MS = 6 * 3600 * 1000;

type Rates = { base: 'USD'; rates: Record<string, number>; fetchedAt: number };

interface LocaleValue {
  lang: string;
  currency: string;
  currencies: string[];
  setLang: (lang: string) => void;
  setCurrency: (currency: string) => void;
  t: (text: string, vars?: Record<string, string | number>) => string;
  /** Converts an amount to the visitor's currency; null when no rate is known. */
  convert: (amount: number, from?: string) => number | null;
  /** Formats an amount in the visitor's currency (falls back to the original currency). */
  money: (amount: number, from?: string) => string;
  /** Formats an amount in its own currency, for "charged as" notes. */
  original: (amount: number, currency?: string) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

function storageGet(key: string) {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function storageJson<T>(key: string): T | null {
  const raw = storageGet(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
function storageSet(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* storage blocked: keep it for this visit only */ }
}

export function normalizeLang(raw: string | undefined | null): string {
  if (!raw) return 'en';
  const [base, region] = raw.replace('_', '-').split('-');
  const lower = base.toLowerCase();
  if (lower === 'zh') return ['TW', 'HK', 'MO', 'HANT'].includes((region ?? '').toUpperCase()) ? 'zh-TW' : 'zh-CN';
  if (lower === 'no' || lower === 'nn') return 'nb';
  if (lower === 'iw') return 'he';
  return /^[a-z]{2,3}$/.test(lower) ? lower : 'en';
}

function detectCountry(): string {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const region = tag?.split(/[-_]/)[1];
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
  }
  const base = (navigator.language || 'en').split(/[-_]/)[0].toLowerCase();
  return LANGUAGE_DEFAULT_COUNTRY[base] ?? 'US';
}

function apiBase() {
  return (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
}

// The visitor's language and currency live in localStorage (or come from the browser), read through
// useSyncExternalStore so the server render stays English/USD and the browser switches right after.
const prefListeners = new Set<() => void>();
function subscribePrefs(listener: () => void) {
  prefListeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    prefListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}
function readPrefs() {
  const lang = normalizeLang(storageGet(LANG_KEY) || navigator.language);
  const currency = storageGet(CURRENCY_KEY) || COUNTRY_CURRENCY[detectCountry()] || 'USD';
  return `${lang}|${currency}`;
}
function writePref(key: string, value: string) {
  storageSet(key, value);
  prefListeners.forEach(listener => listener());
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(subscribePrefs, readPrefs, () => 'en|USD');
  const [lang, currency] = prefs.split('|');
  // Fresh downloads; what earlier visits cached is read from storage below
  const [fetchedDict, setFetchedDict] = useState<{ lang: string; map: Record<string, string> }>({ lang: 'en', map: {} });
  const [fetchedRates, setFetchedRates] = useState<Rates | null>(null);

  const dict = useMemo(() => {
    if (lang === 'en') return {};
    const cached = storageJson<Record<string, string>>(DICT_PREFIX + lang) ?? {};
    return fetchedDict.lang === lang ? { ...cached, ...fetchedDict.map } : cached;
  }, [lang, fetchedDict]);
  const rates = useMemo(() => fetchedRates ?? (currency === 'USD' ? null : storageJson<Rates>(RATES_KEY)), [fetchedRates, currency]);

  useEffect(() => {
    const cached = storageJson<Rates>(RATES_KEY);
    if (cached?.rates && Date.now() - cached.fetchedAt < RATES_MAX_AGE_MS) return;
    fetch(`${apiBase()}/api/rates`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data?.rates) return;
        const next: Rates = { base: 'USD', rates: data.rates, fetchedAt: Date.now() };
        storageSet(RATES_KEY, JSON.stringify(next));
        setFetchedRates(next);
      })
      .catch(() => { /* prices stay in their own currency */ });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = RTL_LANGUAGES.has(lang.split('-')[0]) ? 'rtl' : 'ltr';
    if (lang === 'en') return;
    let cancelled = false;
    const key = DICT_PREFIX + lang;
    let known = storageJson<Record<string, string>>(key) ?? {};

    // The first visitor in a new language waits while it is translated, so ask again for the rest.
    const load = async (attempt: number) => {
      const missing = (CATALOG as string[]).filter(text => !(text in known));
      if (!missing.length || cancelled || attempt > 6) return;
      try {
        const res = await fetch(`${apiBase()}/api/i18n`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, strings: missing }),
        });
        if (!res.ok) return;
        const added = (await res.json()).translations ?? {};
        if (!Object.keys(added).length || cancelled) return;
        known = { ...known, ...added };
        storageSet(key, JSON.stringify(known));
        setFetchedDict({ lang, map: known });
        if (Object.keys(added).length < missing.length) window.setTimeout(() => load(attempt + 1), 1500);
      } catch {
        // offline or API down: English stays
      }
    };
    void load(1);
    return () => { cancelled = true; };
  }, [lang]);

  const setLang = useCallback((next: string) => writePref(LANG_KEY, normalizeLang(next)), []);
  const setCurrency = useCallback((next: string) => writePref(CURRENCY_KEY, next), []);

  const value = useMemo<LocaleValue>(() => {
    const t = (text: string, vars?: Record<string, string | number>) => {
      let out = dict[text] ?? text;
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
      return out;
    };
    const fmt = (amount: number, code: string) => {
      try {
        return new Intl.NumberFormat(lang, {
          style: 'currency', currency: code,
          maximumFractionDigits: amount >= 1000 ? 0 : 2,
        }).format(amount);
      } catch {
        return `${code} ${amount.toFixed(2)}`;
      }
    };
    const convert = (amount: number, from = 'USD') => {
      if (from === currency) return amount;
      const r = rates?.rates;
      if (!r || !r[from] || !r[currency]) return null;
      return (amount / r[from]) * r[currency];
    };
    return {
      lang,
      currency,
      currencies: rates ? Object.keys(rates.rates).sort() : ['USD'],
      setLang,
      setCurrency,
      t,
      convert,
      money: (amount, from = 'USD') => {
        const local = convert(amount, from);
        return local == null ? fmt(amount, from) : fmt(local, currency);
      },
      original: (amount, code = 'USD') => fmt(amount, code),
    };
  }, [lang, currency, dict, rates, setLang, setCurrency]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider');
  return ctx;
}

/** A price in the visitor's currency, with the amount actually charged underneath when they differ. */
export function Price({ amount, currency = 'USD', className, chargedClassName }: {
  amount: number;
  currency?: string;
  className?: string;
  chargedClassName?: string;
}) {
  const { money, original, convert, currency: local, t } = useLocale();
  const converted = local !== currency && convert(amount, currency) != null;
  return (
    <>
      <span className={className}>{converted ? '≈ ' : ''}{money(amount, currency)}</span>
      {converted && (
        <span className={chargedClassName ?? 'block text-[11px] font-normal text-gray-400'}>
          {t('Charged as {amount}', { amount: original(amount, currency) })}
        </span>
      )}
    </>
  );
}
