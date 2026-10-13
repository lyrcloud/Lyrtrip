'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Place {
  code: string;
  type: 'city' | 'airport';
  name: string;
  city: string;
  country: string;
}

interface AirportInputProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Extra classes for the suggestion list, e.g. to line it up with a surrounding field box */
  listClassName?: string;
}

const placesUrl = `${(process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '')}/api/flight/places`;

/**
 * Text input with airport/city suggestions; picking one fills "Name (CODE)"
 */
export default function AirportInput({ name, value, onChange, placeholder, className, id, listClassName = 'mt-1' }: AirportInputProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const picked = useRef(false);
  const listId = useId();

  // Debounced lookup; skipped right after a suggestion is picked
  useEffect(() => {
    if (picked.current) { picked.current = false; return; }
    const query = value.trim();
    if (query.length < 2) { setPlaces([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(placesUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        setPlaces(data.places ?? []);
        setActive(-1);
      } catch {
        if (!ctrl.signal.aborted) setPlaces([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [value]);

  const pick = (p: Place) => {
    picked.current = true;
    onChange(`${p.type === 'city' ? `${p.name} · all airports` : p.name} (${p.code})`);
    setPlaces([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || places.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (i + 1) % places.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (i <= 0 ? places.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(places[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const showList = open && places.length > 0;

  return (
    <div className="relative">
      <input
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={className}
      />
      {loading && (
        <span aria-hidden className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
      )}
      {showList && (
        <ul id={listId} role="listbox" className={`absolute z-30 ${listClassName} max-h-72 w-full min-w-[16rem] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg`}>
          {places.map((p, i) => (
            <li
              key={`${p.type}-${p.code}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${i === active ? 'bg-brand-50' : ''}`}
            >
              <span className="text-lg" aria-hidden>{p.type === 'city' ? '🏙️' : '✈️'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">
                  {p.type === 'city' ? `${p.name} — all airports` : p.name}
                </span>
                <span className="block truncate text-xs text-gray-500">
                  {[p.type === 'airport' ? p.city : null, p.country].filter(Boolean).join(', ')}
                </span>
              </span>
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700">{p.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
