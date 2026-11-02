'use client';

import { useEffect, useState, useRef } from 'react';
import { getPlacePredictions, getPlaceDetails } from "@/lib/PlacePrediction";
import { getMyPlace, locationAllowed } from '@/lib/myPlace';

interface Prediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface LocationPickerProps {
  onLocationSelect: (location: LocationData) => void;
  placeholder?: string;
  /** Fill in the current place on load when the browser already allows location */
  autoNearMe?: boolean;
  /** 'city' for searches by area (stays), 'address' for pickups and drop-offs */
  nearMeAs?: 'city' | 'address';
}

export default function LocationPicker({
  onLocationSelect,
  placeholder = 'Select a location',
  autoNearMe = false,
  nearMeAs = 'address',
}: LocationPickerProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [locating, setLocating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSelectRef = useRef(onLocationSelect);
  useEffect(() => { onSelectRef.current = onLocationSelect; });

  const fillMyLocation = async (quiet = false) => {
    setLocating(true);
    setError(null);
    setSuggestions([]);
    try {
      const place = await getMyPlace();
      const address = nearMeAs === 'city' ? place.city : place.address;
      setInput(address);
      onSelectRef.current({ lat: place.lat, lng: place.lng, address });
    } catch (err) {
      if (!quiet) setError((err as Error).message);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (!autoNearMe) return;
    let live = true;
    locationAllowed().then(ok => { if (ok && live) fillMyLocation(true); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNearMe]);

  const handleInputChange = async (value: string) => {
    setInput(value);
    setError(null);

    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);

    try {
      const predictions = await getPlacePredictions(value);
      setSuggestions(predictions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Autocomplete error occurred';
      console.error('Autocomplete error:', err);
      setError(errorMessage);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLocation = async (prediction: Prediction) => {
    setInput(prediction.description);
    setSuggestions([]);
    setError(null);

    try {
      const location = await getPlaceDetails(prediction.place_id);
      
      if (location) {
        onLocationSelect(location);
      } else {
        setError('Failed to fetch location details');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch location details';
      console.error('Place details error:', err);
      setError(errorMessage);
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder={locating ? 'Finding your location…' : placeholder}
        className="w-full px-4 py-3 text-base text-gray-900 bg-gray-50 border border-gray-200 rounded-xl shadow-sm transition-all duration-200 placeholder:text-gray-400 hover:border-brand-300 hover:bg-white focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-3 top-3.5">
          <div className="animate-spin h-5 w-5 text-brand-600" />
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm mt-1">{error}</p>
      )}

      {focused && !input.trim() && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-50">
          <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setFocused(false); fillMyLocation(); }}
            className="w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors focus:outline-none focus:bg-brand-50 rounded-lg"
          >
            <div className="font-semibold text-brand-700">📍 Use my current location</div>
            <div className="text-sm text-gray-600">Show options near you</div>
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
          <ul className="divide-y divide-gray-100 py-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelectLocation(suggestion)}
                  className="w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors focus:outline-none focus:bg-brand-50 text-black"
                >
                  <div className="font-semibold text-gray-900">{suggestion.main_text}</div>
                  {suggestion.secondary_text && (
                    <div className="text-sm text-gray-600">{suggestion.secondary_text}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}