'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '@/i18n/LocaleContext';
import { LANGUAGES } from '@/i18n/regions';

function displayName(code: string, type: 'language' | 'currency', locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Globe button in the nav: change the site language and the currency prices are shown in. */
export default function LocalePicker() {
  const { lang, currency, currencies, setLang, setCurrency, t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  // A detected language outside the list still gets an entry, named in its own language
  const languages = useMemo(
    () => (LANGUAGES.some(l => l.code === lang) ? LANGUAGES : [...LANGUAGES, { code: lang, name: displayName(lang, 'language', lang) }]),
    [lang],
  );

  const select = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={t('Language and currency')}
        className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
        </svg>
        <span className="uppercase">{lang.split('-')[0]}</span>
        <span className="text-gray-300">·</span>
        <span>{currency}</span>
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg p-4 space-y-3 z-50">
          <label className="block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">{t('Language')}</span>
            <select className={select} value={lang} onChange={e => setLang(e.target.value)}>
              {languages.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-gray-500 mb-1">{t('Currency')}</span>
            <select className={select} value={currency} onChange={e => setCurrency(e.target.value)}>
              {(currencies.includes(currency) ? currencies : [currency, ...currencies]).map(code => (
                <option key={code} value={code}>{code} · {displayName(code, 'currency', lang)}</option>
              ))}
            </select>
          </label>
          <p className="text-[11px] leading-snug text-gray-500">
            {t('Prices in other currencies are estimates from daily exchange rates. You are charged in the currency shown at checkout.')}
          </p>
        </div>
      )}
    </div>
  );
}
