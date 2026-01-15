'use client';

import { useState, useRef } from 'react';
import { getPlacePredictions, getPlaceDetails } from "@/lib/PlacePrediction";

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
}

export default function LocationPicker({ 
  onLocationSelect, 
  placeholder = 'Select a location' 
}: LocationPickerProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = async (value: string) => {
    setInput(value);
    setError(null);

    if (!value.trim()) {
      setSuggestions([]);
      console.log('Input empty');
      return;
    }

    setLoading(true);
    console.log('Searching for:', value);

    try {
      const predictions = await getPlacePredictions(value);
      setSuggestions(predictions);
      console.log('Suggestions set:', predictions.length);
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
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
        autoComplete="off"
      />

      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="animate-spin h-5 w-5 text-indigo-600" />
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm mt-1">{error}</p>
      )}

      {suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
          <ul className="divide-y divide-gray-100 py-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelectLocation(suggestion)}
                  className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors focus:outline-none focus:bg-indigo-50 text-black"
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