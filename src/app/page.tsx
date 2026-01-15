'use client';

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import React from 'react';
import LocationMap from '@/components/LocationMap';
import LocationPicker from '@/components/LocationPicker';

interface SearchResult {
  id: string;
  name: string;
  price?: number;
  description?: string;
  rating?: number;
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('hotels');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);

  const [formData, setFormData] = useState({
    destination: '',
    destinationLocation: null as LocationData | null,
    checkin: '',
    checkout: '',
    from: '',
    fromLocation: null as LocationData | null,
    to: '',
    toLocation: null as LocationData | null,
    depart: '',
    return: '',
    location: '',
    pickupLocation: null as LocationData | null,
    pickupDate: '',
    returnDate: '',
  });

  const [userLocation, setUserLocation] = useState({ lat: 40.7128, lng: -74.0060 });
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationLoading(false);
        },
        (error) => {
          setLocationError('Unable to access your location');
          setLocationLoading(false);
        }
      );
    } else {
      setLocationError('Geolocation not supported');
      setLocationLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLocationSelect = (locationKey: string, location: LocationData) => {
    setFormData(prev => ({
      ...prev,
      [locationKey]: location,
      [locationKey.replace('Location', '')]: location.address,
    }));
  };

  const handleSearch = async (service: string) => {
    setLoading(true);
    setHasSearched(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service, ...formData }),
      });
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'hotels', label: '🏨 Hotels' },
    { id: 'flights', label: '✈️ Flights' },
    { id: 'car', label: '🚗 Car' },
    { id: 'bus', label: '🚌 Bus' },
    { id: 'train', label: '🚂 Train' },
    { id: 'cruise', label: '🚢 Cruise' },
    { id: 'dash', label: '🍔 Dash' },
    { id: 'tourism', label: '🎒 Tourism' },
    { id: 'study', label: '📚 Study' },
    { id: 'career', label: '💼 Career' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="Lyrtrip logo"
              width={120}
              height={48}
              priority
              className="w-32 h-12 rounded-lg shadow-md hover:shadow-lg transition-shadow object-contain"
            />
          </Link>
          <button className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors">
            Sign In
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
        <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">

          {/* Hero Section with Location Button */}
          <div className="text-center mb-16">
            <button 
              onClick={() => setShowLocationMap(!showLocationMap)}
              className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showLocationMap ? '✕ Hide Map' : '📍 My Location'}
            </button>
          </div>

          {/* Location Map Display */}
          {showLocationMap && (
            <div className="mb-12 bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Current Location</h2>
              {locationLoading ? (
                <p className="text-gray-600">Loading your location...</p>
              ) : locationError ? (
                <p className="text-red-600">{locationError}</p>
              ) : (
                <LocationMap 
                  lat={userLocation.lat} 
                  lng={userLocation.lng} 
                  zoom={14}
                  title="Your Current Location"
                />
              )}
            </div>
          )}

          {/* Search Tabs */}
          <div className="bg-white rounded-lg shadow-lg">
            {/* Tab Navigation */}
            <div className="flex border-b overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 px-6 py-4 text-center font-bold whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Form */}
            <div className="p-8">
              {activeTab === 'hotels' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                      <LocationPicker
                        onLocationSelect={(loc) => handleLocationSelect('destinationLocation', loc)}
                        placeholder="Select hotel location"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
                      <input
                        type="date"
                        name="checkin"
                        value={formData.checkin}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
                      <input
                        type="date"
                        name="checkout"
                        value={formData.checkout}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('hotels')}
                        disabled={loading || !formData.destinationLocation}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'flights' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                      <input
                        type="text"
                        name="from"
                        value={formData.from}
                        onChange={handleInputChange}
                        placeholder="Departure city"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                      <input
                        type="text"
                        name="to"
                        value={formData.to}
                        onChange={handleInputChange}
                        placeholder="Destination city"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Depart</label>
                      <input
                        type="date"
                        name="depart"
                        value={formData.depart}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Return</label>
                      <input
                        type="date"
                        name="return"
                        value={formData.return}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('flights')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'car' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="Pickup location"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Date</label>
                      <input
                        type="date"
                        name="pickupDate"
                        value={formData.pickupDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Return Date</label>
                      <input
                        type="date"
                        name="returnDate"
                        value={formData.returnDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('car')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}/day</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'bus' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                      <input
                        type="text"
                        name="from"
                        value={formData.from}
                        onChange={handleInputChange}
                        placeholder="Departure city"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                      <input
                        type="text"
                        name="to"
                        value={formData.to}
                        onChange={handleInputChange}
                        placeholder="Destination city"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Depart</label>
                      <input
                        type="date"
                        name="depart"
                        value={formData.depart}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('bus')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'train' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                      <input
                        type="text"
                        name="from"
                        value={formData.from}
                        onChange={handleInputChange}
                        placeholder="Departure station"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                      <input
                        type="text"
                        name="to"
                        value={formData.to}
                        onChange={handleInputChange}
                        placeholder="Destination station"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Depart</label>
                      <input
                        type="date"
                        name="depart"
                        value={formData.depart}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('train')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'cruise' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Departure Port</label>
                      <input
                        type="text"
                        name="from"
                        value={formData.from}
                        onChange={handleInputChange}
                        placeholder="Departure port"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Departure Date</label>
                      <input
                        type="date"
                        name="depart"
                        value={formData.depart}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Duration (days)</label>
                      <input
                        type="number"
                        placeholder="Number of days"
                        title="Number of days for cruise duration"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('cruise')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'dash' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="Delivery location"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine</label>
                      <input
                        type="text"
                        placeholder="E.g., Italian, Chinese"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                      <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent">
                        <option>Any</option>
                        <option>$ - Budget</option>
                        <option>$$ - Moderate</option>
                        <option>$$$ - Premium</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('dash')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'tourism' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                      <input
                        type="text"
                        name="destination"
                        value={formData.destination}
                        onChange={handleInputChange}
                        placeholder="City or attraction"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
                      <input
                        type="text"
                        placeholder="E.g., Museum, Adventure"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        name="depart"
                        value={formData.depart}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('tourism')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'study' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Country/Region</label>
                      <input
                        type="text"
                        name="to"
                        value={formData.to}
                        onChange={handleInputChange}
                        placeholder="Study destination"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
                      <input
                        type="text"
                        placeholder="E.g., Bachelor, Master"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="date"
                        name="depart"
                        value={formData.depart}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('study')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'career' && (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                      <input
                        type="text"
                        placeholder="E.g., Software Engineer"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                      <input
                        type="text"
                        name="location"
                        value={formData.location}
                        onChange={handleInputChange}
                        placeholder="City or remote"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                      <input
                        type="text"
                        placeholder="E.g., Technology, Finance"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => handleSearch('career')}
                        disabled={loading}
                        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                      >
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                  </div>
                  {hasSearched && (
                    <div className="mt-6">
                      {results.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {results.map(result => (
                            <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
                              <h3 className="font-bold text-gray-900">{result.name}</h3>
                              <p className="text-sm text-gray-600 mt-2">{result.description}</p>
                              {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
                              {result.price && <p className="text-lg font-bold text-indigo-600 mt-2">${result.price}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">No results found. Try different search criteria.</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-16 border-t border-gray-200 pt-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h3 className="font-bold text-gray-900 mb-4">About</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><a href="#" className="hover:text-indigo-600">About Us</a></li>
                  <li><a href="#" className="hover:text-indigo-600">Blog</a></li>
                  <li><a href="#" className="hover:text-indigo-600">Careers</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-4">Support</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><a href="#" className="hover:text-indigo-600">Help Center</a></li>
                  <li><a href="#" className="hover:text-indigo-600">Contact Us</a></li>
                  <li><a href="#" className="hover:text-indigo-600">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-4">Legal</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><a href="#" className="hover:text-indigo-600">Privacy Policy</a></li>
                  <li><a href="#" className="hover:text-indigo-600">Terms of Service</a></li>
                  <li><a href="#" className="hover:text-indigo-600">Cookies</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-4">Follow</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li><a href="#" className="hover:text-indigo-600">Facebook</a></li>
                  <li><a href="#" className="hover:text-indigo-600">Twitter</a></li>
                  <li><a href="#" className="hover:text-indigo-600">Instagram</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-200 pt-8 flex justify-between items-center">
              <p className="text-sm text-gray-600">&copy; 2026 Lyrtrip. All rights reserved.</p>
              <div className="flex gap-4">
                <a href="#" className="text-sm text-gray-600 hover:text-indigo-600">Sitemap</a>
                <a href="#" className="text-sm text-gray-600 hover:text-indigo-600">Accessibility</a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
