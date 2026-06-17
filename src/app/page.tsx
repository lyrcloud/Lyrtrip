'use client';

import { useState, useEffect } from "react";
import React from 'react';
import LocationMap from '@/components/LocationMap';
import LocationPicker from '@/components/LocationPicker';
import { searchHotels } from '@/lib/api';

interface SearchResult {
  id: string;
  name: string;
  price?: number;
  description?: string;
  rating?: number;
  unit?: string;
  currency?: string;
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

const mockData: Record<string, SearchResult[]> = {
  hotels: [
    { id: '1', name: 'Luxury Palace Hotel', description: '5-star hotel with ocean view', rating: 4.8, price: 250, unit: '/night' },
    { id: '2', name: 'Downtown Inn', description: 'Modern boutique hotel in city center', rating: 4.5, price: 120, unit: '/night' },
    { id: '3', name: 'Budget Stay', description: 'Affordable accommodation with good service', rating: 4.2, price: 65, unit: '/night' },
  ],
  flights: [
    { id: '1', name: 'Emirates Flight EK123', description: 'Direct flight — Business class available', rating: 4.7, price: 450 },
    { id: '2', name: 'Swiss International', description: '1 stop — Economy and Business', rating: 4.6, price: 380 },
    { id: '3', name: 'Budget Airline', description: 'Low cost carrier — Direct route', rating: 4.1, price: 180 },
  ],
  car: [
    { id: '1', name: 'Tesla Model 3', description: 'Electric vehicle, luxury experience', rating: 4.9, price: 120, unit: '/day' },
    { id: '2', name: 'Toyota Camry', description: 'Reliable and comfortable sedan', rating: 4.5, price: 55, unit: '/day' },
    { id: '3', name: 'Hyundai i20', description: 'Budget-friendly economy car', rating: 4.3, price: 35, unit: '/day' },
  ],
  bus: [
    { id: '1', name: 'VIP Coach', description: 'Luxury seats, AC, WiFi, meals included', rating: 4.7, price: 95 },
    { id: '2', name: 'Express Bus', description: 'Direct route, comfortable seats', rating: 4.4, price: 55 },
    { id: '3', name: 'Economy Bus', description: 'Standard seating, basic amenities', rating: 4.1, price: 25 },
  ],
  train: [
    { id: '1', name: 'High Speed — First Class', description: 'Ultra-fast, private cabin, meals included', rating: 4.8, price: 180 },
    { id: '2', name: 'Express — Business Class', description: 'Fast service, comfortable seating', rating: 4.6, price: 95 },
    { id: '3', name: 'Standard Train', description: 'Economy travel with good amenities', rating: 4.2, price: 45 },
  ],
  cruise: [
    { id: '1', name: 'Caribbean Paradise', description: '7 days — All-inclusive, entertainment nightly', rating: 4.9, price: 1200 },
    { id: '2', name: 'Mediterranean Cruise', description: '10 days — Multiple ports, luxury cabins', rating: 4.7, price: 2000 },
    { id: '3', name: 'Budget Cruise Adventure', description: '4 days — Beautiful destinations, fun activities', rating: 4.3, price: 450 },
  ],
  dash: [
    { id: '1', name: 'Mama Mia — Italian', description: 'Authentic pizza and pasta, 30-45 min delivery', rating: 4.8, price: 35 },
    { id: '2', name: 'Dragon Palace — Asian Fusion', description: 'Chinese, Thai, Vietnamese cuisine', rating: 4.6, price: 28 },
    { id: '3', name: 'Burger & Fries Heaven', description: 'Gourmet burgers, hand-cut fries, shakes', rating: 4.5, price: 22 },
  ],
  tourism: [
    { id: '1', name: 'Eiffel Tower Tour', description: 'Guided tour with skip-the-line tickets, 3 hours', rating: 4.9, price: 95 },
    { id: '2', name: 'City Walking Tour', description: 'Explore hidden gems with a local guide, 2.5 hours', rating: 4.6, price: 45 },
    { id: '3', name: 'Museum Pass — 24 Hours', description: 'Access to 5 major museums with guide', rating: 4.7, price: 85 },
  ],
  study: [
    { id: '1', name: 'Oxford — Masters Program', description: 'Prestigious postgraduate degree, 1 year', rating: 4.9, price: 35000, unit: '/year' },
    { id: '2', name: 'Univ. of Toronto — Bachelor', description: 'International student program, 4 years', rating: 4.7, price: 25000, unit: '/year' },
    { id: '3', name: 'Online Certificate Course', description: 'Professional certification, self-paced, 3 months', rating: 4.5, price: 599 },
  ],
  career: [
    { id: '1', name: 'Senior Software Engineer — Google', description: 'Remote position, competitive salary, benefits', rating: 4.8, price: 200000, unit: '/yr' },
    { id: '2', name: 'Product Manager — Startup', description: 'Growth-focused role, equity options, NYC', rating: 4.6, price: 150000, unit: '/yr' },
    { id: '3', name: 'Junior Developer — Tech Company', description: 'Entry-level, mentorship, remote-friendly', rating: 4.4, price: 80000, unit: '/yr' },
  ],
};

function searchService(service: string): Promise<SearchResult[]> {
  return new Promise(resolve => setTimeout(() => resolve(mockData[service] ?? []), 400));
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
    cruiseDays: '',
    cuisine: '',
    priceRange: 'Any',
    activityType: '',
    courseType: '',
    jobTitle: '',
    industry: '',
  });

  const [userLocation, setUserLocation] = useState({ lat: 40.7128, lng: -74.0060 });
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setLocationLoading(false);
        },
        () => {
          setLocationError('Unable to access your location');
          setLocationLoading(false);
        }
      );
    } else {
      setLocationError('Geolocation not supported');
      setLocationLoading(false);
    }
  }, []);

  const switchTab = (tabId: string) => {
    setActiveTab(tabId);
    setResults([]);
    setHasSearched(false);
  };

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
      if (service === 'hotels' && formData.destinationLocation) {
        const data = await searchHotels({
          destinationLocation: formData.destinationLocation,
          checkin: formData.checkin || undefined,
          checkout: formData.checkout || undefined,
        });
        setResults(data);
      } else {
        const data = await searchService(service);
        setResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'hotels',  label: '🏨 Hotels' },
    { id: 'flights', label: '✈️ Flights' },
    { id: 'car',     label: '🚗 Car' },
    { id: 'bus',     label: '🚌 Bus' },
    { id: 'train',   label: '🚂 Train' },
    { id: 'cruise',  label: '🚢 Cruise' },
    { id: 'dash',    label: '🍔 Dash' },
    { id: 'tourism', label: '🎒 Tourism' },
    { id: 'study',   label: '📚 Study' },
    { id: 'career',  label: '💼 Career' },
  ];

  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent";
  const searchBtn = (service: string, disabled = false) => (
    <div className="flex items-end">
      <button
        onClick={() => handleSearch(service)}
        disabled={loading || disabled}
        className="w-full px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </div>
  );

  const ResultsGrid = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching...</p>;
    if (results.length === 0) return <p className="text-gray-600 mt-6">No results found. Try different search criteria.</p>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {results.map(result => (
          <div key={result.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-lg transition">
            <h3 className="font-bold text-gray-900">{result.name}</h3>
            <p className="text-sm text-gray-600 mt-2">{result.description}</p>
            {result.rating && <p className="text-yellow-500 mt-2">⭐ {result.rating}</p>}
            {result.price !== undefined && (
              <p className="text-lg font-bold text-indigo-600 mt-2">
                {result.currency && result.currency !== 'USD' ? result.currency + ' ' : '$'}
                {result.price.toLocaleString()}{result.unit ?? ''}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 to-blue-50">
      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">

        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-extrabold text-indigo-700 mb-4">Lyrtrip</h1>
          <p className="text-lg text-gray-600 mb-8">Your all-in-one travel & lifestyle platform</p>
          <button
            onClick={() => setShowLocationMap(!showLocationMap)}
            className="px-8 py-4 bg-indigo-600 text-white text-lg font-bold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {showLocationMap ? '✕ Hide Map' : '📍 My Location'}
          </button>
        </div>

        {/* Location Map */}
        {showLocationMap && (
          <div className="mb-12 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Current Location</h2>
            {locationLoading ? (
              <p className="text-gray-600">Loading your location...</p>
            ) : locationError ? (
              <p className="text-red-600">{locationError}</p>
            ) : (
              <LocationMap lat={userLocation.lat} lng={userLocation.lng} zoom={14} title="Your Current Location" />
            )}
          </div>
        )}

        {/* Search Tabs */}
        <div className="bg-white rounded-lg shadow-lg">
          {/* Tab Nav */}
          <div className="flex border-b overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
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

          {/* Forms */}
          <div className="p-8">

            {/* Hotels */}
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
                    <input type="date" name="checkin" value={formData.checkin} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
                    <input type="date" name="checkout" value={formData.checkout} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('hotels')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Flights */}
            {activeTab === 'flights' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                    <input type="text" name="from" value={formData.from} onChange={handleInputChange} placeholder="Departure city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                    <input type="text" name="to" value={formData.to} onChange={handleInputChange} placeholder="Destination city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Depart</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Return</label>
                    <input type="date" name="return" value={formData.return} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('flights')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Car */}
            {activeTab === 'car' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="City or airport" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Date</label>
                    <input type="date" name="pickupDate" value={formData.pickupDate} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Return Date</label>
                    <input type="date" name="returnDate" value={formData.returnDate} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('car')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Bus */}
            {activeTab === 'bus' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                    <input type="text" name="from" value={formData.from} onChange={handleInputChange} placeholder="Departure city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                    <input type="text" name="to" value={formData.to} onChange={handleInputChange} placeholder="Destination city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Depart</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('bus')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Train */}
            {activeTab === 'train' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                    <input type="text" name="from" value={formData.from} onChange={handleInputChange} placeholder="Departure station" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                    <input type="text" name="to" value={formData.to} onChange={handleInputChange} placeholder="Destination station" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Depart</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('train')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Cruise */}
            {activeTab === 'cruise' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departure Port</label>
                    <input type="text" name="from" value={formData.from} onChange={handleInputChange} placeholder="Port city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departure Date</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration (days)</label>
                    <input type="number" name="cruiseDays" value={formData.cruiseDays} onChange={handleInputChange} placeholder="Number of days" min="1" className={inputClass} />
                  </div>
                  {searchBtn('cruise')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Dash (Food Delivery) */}
            {activeTab === 'dash' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="Your address" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine</label>
                    <input type="text" name="cuisine" value={formData.cuisine} onChange={handleInputChange} placeholder="E.g. Italian, Chinese" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                    <select name="priceRange" value={formData.priceRange} onChange={handleInputChange} className={inputClass}>
                      <option>Any</option>
                      <option>$ — Budget</option>
                      <option>$$ — Moderate</option>
                      <option>$$$ — Premium</option>
                    </select>
                  </div>
                  {searchBtn('dash')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Tourism */}
            {activeTab === 'tourism' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Destination</label>
                    <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} placeholder="City or attraction" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
                    <input type="text" name="activityType" value={formData.activityType} onChange={handleInputChange} placeholder="E.g. Museum, Adventure" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('tourism')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Study */}
            {activeTab === 'study' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Country / Region</label>
                    <input type="text" name="to" value={formData.to} onChange={handleInputChange} placeholder="Study destination" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
                    <input type="text" name="courseType" value={formData.courseType} onChange={handleInputChange} placeholder="E.g. Bachelor, Master" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('study')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Career */}
            {activeTab === 'career' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Title</label>
                    <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} placeholder="E.g. Software Engineer" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="City or remote" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                    <input type="text" name="industry" value={formData.industry} onChange={handleInputChange} placeholder="E.g. Technology, Finance" className={inputClass} />
                  </div>
                  {searchBtn('career')}
                </div>
                <ResultsGrid />
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
                <li><a href="/privacy" className="hover:text-indigo-600">Privacy Policy</a></li>
                <li><a href="/data-deletion" className="hover:text-indigo-600">Data Deletion</a></li>
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
  );
}
