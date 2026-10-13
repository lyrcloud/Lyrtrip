'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Place {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  priceLevel?: number;
  photoUrl?: string;
  website?: string;
  phone?: string;
}

interface HotelSearchProps {
  lat?: number;
  lng?: number;
}

const PLACE_TYPES = [
  { value: 'lodging',             label: 'Hotels' },
  { value: 'restaurant',          label: 'Restaurants' },
  { value: 'cafe',                label: 'Cafes' },
  { value: 'tourist_attraction',  label: 'Attractions' },
];

// New Places API returns string enum values; map to 0-4 scale
const PRICE_ENUM: Record<string, number> = {
  PRICE_LEVEL_FREE:          0,
  PRICE_LEVEL_INEXPENSIVE:   1,
  PRICE_LEVEL_MODERATE:      2,
  PRICE_LEVEL_EXPENSIVE:     3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const PRICE_LABEL: Record<number, string> = {
  0: 'Free',
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

export default function HotelSearch({ lat = 48.8566, lng = 2.3522 }: HotelSearchProps) {
  const [query, setQuery]         = useState('');
  const [placeType, setPlaceType] = useState('lodging');
  const [results, setResults]     = useState<Place[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const g = (window as any).google;
      if (!g?.maps?.importLibrary) {
        setError('Google Maps not loaded. Check your API key.');
        return;
      }

      const { Place } = await g.maps.importLibrary('places') as any;

      const typeLabel = PLACE_TYPES.find(t => t.value === placeType)?.label ?? 'Places';
      const textQuery = query.trim() || typeLabel;

      const { places } = await Place.searchByText({
        textQuery,
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'rating',
          'priceLevel',
          'photos',
          'websiteURI',
          'nationalPhoneNumber',
        ],
        includedType: placeType,
        locationBias: { lat, lng },
        maxResultCount: 20,
      });

      const mapped: Place[] = (places ?? []).map((p: any) => ({
        placeId:    p.id,
        name:       p.displayName ?? '',
        address:    p.formattedAddress ?? '',
        rating:     p.rating,
        priceLevel: p.priceLevel != null ? (PRICE_ENUM[p.priceLevel] ?? undefined) : undefined,
        photoUrl:   p.photos?.[0]?.getURI?.({ maxWidth: 400 }),
        website:    p.websiteURI,
        phone:      p.nationalPhoneNumber,
      }));

      // Cheapest first; unpriced results go to the end
      mapped.sort((a, b) => {
        if (a.priceLevel == null && b.priceLevel == null) return 0;
        if (a.priceLevel == null) return 1;
        if (b.priceLevel == null) return -1;
        return a.priceLevel - b.priceLevel;
      });

      setResults(mapped);
      if (mapped.length === 0) setError('No results found for this location.');
    } catch (err: any) {
      setError(err?.message ?? 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = PLACE_TYPES.find(t => t.value === placeType)?.label ?? 'Places';

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="mb-4 space-y-2">
        <select
          value={placeType}
          onChange={e => setPlaceType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {PLACE_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder={`Search ${typeLabel.toLowerCase()} by location…`}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <button
          onClick={search}
          disabled={loading}
          className="w-full px-4 py-2 bg-btn text-white rounded-lg hover:bg-btn-hover disabled:bg-gray-400 transition"
        >
          {loading ? 'Searching…' : `Search ${typeLabel} — sorted by cheapest`}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>
      )}

      <div className="grid gap-4">
        {results.map(place => (
          <div
            key={place.placeId}
            className="border border-gray-200 rounded-lg overflow-hidden bg-white text-gray-900 hover:shadow-lg transition"
          >
            {place.photoUrl && (
              <Image
                src={place.photoUrl}
                alt={place.name}
                className="w-full h-48 object-cover"
                width={400}
                height={192}
                unoptimized
              />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{place.name}</h3>
                {place.priceLevel != null && (
                  <span className="shrink-0 text-green-700 font-bold text-sm bg-green-50 px-2 py-0.5 rounded">
                    {PRICE_LABEL[place.priceLevel]}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 mt-1">{place.address}</p>

              {place.rating != null && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-yellow-500">★</span>
                  <span className="text-sm text-gray-700">{place.rating.toFixed(1)}</span>
                </div>
              )}

              {place.phone && (
                <p className="text-sm text-gray-600 mt-2">📞 {place.phone}</p>
              )}

              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 px-4 py-2 bg-btn text-white text-sm rounded hover:bg-btn-hover transition"
                >
                  Visit Website
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && !error && (
        <div className="text-center text-gray-500 py-8">
          Enter a location and click Search to see results sorted by price
        </div>
      )}
    </div>
  );
}
