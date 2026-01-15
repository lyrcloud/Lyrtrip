'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

// Declare google namespace for type checking
interface PlacesServiceRequest {
  query: string;
  type?: string;
}

interface PlacesResult {
  name?: string;
  formatted_address?: string;
  rating?: number;
  place_id?: string;
  photos?: Array<{ getUrl: () => string }>;
  website?: string;
  formatted_phone_number?: string;
}

interface GoogleMapsOptions {
  center: { lat: number; lng: number };
  zoom: number;
}

declare global {
  interface Window {
    google: {
      maps: {
        places: {
          PlacesService: new (map: unknown) => {
            textSearch(
              request: PlacesServiceRequest,
              callback: (results: PlacesResult[], status: string) => void
            ): void;
          };
          PlacesServiceStatus: {
            OK: string;
          };
        };
        Map: new (element: HTMLElement, options: GoogleMapsOptions) => unknown;
      };
    };
  }
}

interface Hotel {
  name: string;
  address: string;
  rating?: number;
  placeId: string;
  photoUrl?: string;
  website?: string;
  phoneNumber?: string;
}

interface HotelSearchProps {
  query?: string;
  lat?: number;
  lng?: number;
}

type PlaceType = 'lodging' | 'restaurant' | 'cafe' | 'tourist_attraction';

const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  lodging: 'Hotels',
  restaurant: 'Restaurants',
  cafe: 'Cafes',
  tourist_attraction: 'Attractions',
};

/**
 * HotelSearch component to search for hotels using Google Places API
 */

export default function HotelSearch({
  query: initialQuery = 'hotels in Paris',
  lat,
  lng,
}: HotelSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [placeType, setPlaceType] = useState<PlaceType>('lodging');
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  type HotelSearchService = InstanceType<typeof window.google.maps.places.PlacesService>;
  const serviceRef = useRef<HotelSearchService | null>(null);

  useEffect(() => {
    // SSR safety: only run on client
    if (typeof window === 'undefined' || !window.google) {
      // Avoid synchronous setState in effect
      setTimeout(() => {
        setError(
          'Google Maps API is not loaded. Please check your API key and script include.'
        );
      }, 0);
      return;
    }
    if (!mapRef.current) return;

    // Create a dummy map for PlacesService
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: lat ?? 48.8566, lng: lng ?? 2.3522 },
      zoom: 12,
    });

    const service = new window.google.maps.places.PlacesService(map);
    serviceRef.current = service;
  }, [lat, lng]);

  const searchPlaces = async () => {
    if (!serviceRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const request = {
        query,
        type: placeType,
      };

      serviceRef.current.textSearch(request, (results, status) => {
        console.log('PlacesService callback:', { status, results });
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          const placeList: Hotel[] = results.map((place) => ({
            name: place.name || '',
            address: place.formatted_address || '',
            rating: place.rating,
            placeId: place.place_id || '',
            photoUrl: place.photos?.[0]?.getUrl(),
            website: place.website,
            phoneNumber: place.formatted_phone_number,
          }));
          setHotels(placeList);
        } else if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length === 0) {
          setHotels([]);
          setError('No results found for this location.');
        } else {
          setError(`Search failed: ${status}`);
        }
        setLoading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="mb-4">
        <label htmlFor="place-type" className="block mb-2 font-medium">
          Place Type
        </label>
        <select
          id="place-type"
          value={placeType}
          onChange={e => setPlaceType(e.target.value as PlaceType)}
          className="mb-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {Object.entries(PLACE_TYPE_LABELS).map(([type, label]) => (
            <option key={type} value={type}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search for ${PLACE_TYPE_LABELS[placeType].toLowerCase()}...`}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={searchPlaces}
          disabled={loading}
          className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {loading ? 'Searching...' : `Search ${PLACE_TYPE_LABELS[placeType]}`}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {hotels.map((hotel) => (
          <div
            key={hotel.placeId}
            className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition"
          >
            {hotel.photoUrl && (
              <Image
                src={hotel.photoUrl}
                alt={hotel.name}
                className="w-full h-48 object-cover"
                width={400}
                height={192}
              />
            )}
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900">{hotel.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{hotel.address}</p>
              {hotel.rating && (
                <div className="mt-2 flex items-center">
                  <span className="text-yellow-500">★</span>
                  <span className="ml-1 text-sm text-gray-700">{hotel.rating.toFixed(1)}</span>
                </div>
              )}
              {hotel.phoneNumber && (
                <p className="text-sm text-gray-600 mt-2">📞 {hotel.phoneNumber}</p>
              )}
              {hotel.website && (
                <a
                  href={hotel.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                >
                  Visit Website
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {hotels.length === 0 && !loading && !error && (
        <div className="text-center text-gray-500 py-8">
          Click &quot;Search Hotels&quot; to find accommodations
        </div>
      )}
      {hotels.length === 0 && !loading && error === 'No hotels found for this location.' && (
        <div className="text-center text-gray-500 py-8">
          No hotels found for this location.
        </div>
      )}

      {/* Hidden map for PlacesService */}
      <div ref={mapRef} className="hidden" />
    </div>
  );
}
