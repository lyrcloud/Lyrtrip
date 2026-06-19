'use client';

import { useState, useEffect } from "react";
import React from 'react';
import { useRouter } from 'next/navigation';
import LocationMap from '@/components/LocationMap';
import LocationPicker from '@/components/LocationPicker';
import { saveBooking, calcNights, PRICE_PER_NIGHT } from '@/lib/bookings';
import { useAuth } from '@/context/AuthContext';

interface FlightLeg {
  airline: string;
  airlineLogo: string;
  flightNumber: string;
  departure: { airport: string; name: string; time: string };
  arrival: { airport: string; name: string; time: string };
  duration: number;
  airplane: string;
  travelClass: string;
  legroom?: string;
  extensions: string[];
}

interface FlightLayover {
  name: string;
  id: string;
  duration: number;
  overnight?: boolean;
}

interface SearchResult {
  id: string;
  name: string;
  price?: number;
  description?: string;
  rating?: number;
  unit?: string;
  currency?: string;
  priceLevel?: string;
  pricePerNight?: number;
  imageUrl?: string;
  link?: string;
  checkIn?: string;
  checkOut?: string;
  reviewCount?: number;
  amenities?: string[];
  hotelClass?: number;
  // flight-specific
  type?: 'flight';
  isBest?: boolean;
  totalDuration?: number;
  legs?: FlightLeg[];
  layovers?: FlightLayover[];
  extensions?: string[];
  bookingToken?: string;
  airlineLogo?: string;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(datetime: string): string {
  return datetime?.split(' ')[1] ?? datetime ?? '';
}

interface BookingDraft {
  hotel: SearchResult;
  checkin: string;
  checkout: string;
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

const PENDING_BOOKING_KEY = 'lyrtrip_pending_booking';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
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
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [bookingName, setBookingName] = useState('');
  const [bookingGuests, setBookingGuests] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);

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

  // After login redirect back with ?booking=pending — auto-trigger Stripe
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('booking') !== 'pending') return;
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return;
    try {
      const draft: BookingDraft = JSON.parse(raw);
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
      // Strip the query param without a reload
      window.history.replaceState({}, '', '/');
      setActiveTab('hotels');
      // Small delay so the tab renders before we open the modal
      setTimeout(() => {
        setBookingDraft(draft);
        setBookingName('');
        setBookingGuests(1);
      }, 100);
    } catch { /* ignore */ }
  }, [user]);

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

  const searchHotelsViaApi = async (): Promise<SearchResult[]> => {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service:     'hotels',
        destination: formData.destination || formData.destinationLocation?.address || '',
        checkin:     formData.checkin  || null,
        checkout:    formData.checkout || null,
        guests:      1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Hotel search failed');
    return (data.results ?? []) as SearchResult[];
  };

  const searchFlightsViaApi = async (): Promise<SearchResult[]> => {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service:    'flights',
        from:       formData.from,
        to:         formData.to,
        depart:     formData.depart || null,
        returnDate: formData.return || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Flight search failed');
    return (data.results ?? []) as SearchResult[];
  };

  const handleSearch = async (service: string) => {
    setLoading(true);
    setHasSearched(true);
    try {
      if (service === 'hotels') {
        const data = await searchHotelsViaApi();
        setResults(data);
      } else if (service === 'flights') {
        const data = await searchFlightsViaApi();
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

  const confirmBooking = async () => {
    if (!bookingDraft || !bookingName.trim()) return;

    if (!user) {
      sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(bookingDraft));
      router.push('/login');
      return;
    }

    const nights        = calcNights(bookingDraft.checkin, bookingDraft.checkout);
    const pricePerNight = bookingDraft.hotel.pricePerNight ?? PRICE_PER_NIGHT[bookingDraft.hotel.priceLevel ?? '$$'] ?? 160;
    const totalPrice    = pricePerNight * nights * bookingGuests;

    saveBooking({
      hotelName:    bookingDraft.hotel.name,
      address:      bookingDraft.hotel.description ?? '',
      checkin:      bookingDraft.checkin,
      checkout:     bookingDraft.checkout,
      guests:       bookingGuests,
      guestName:    bookingName.trim(),
      priceLevel:   bookingDraft.hotel.priceLevel,
      pricePerNight,
      nights,
      totalPrice,
    });

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_STRIPE_LAMBDA_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName:  bookingDraft.hotel.name,
          address:    bookingDraft.hotel.description ?? '',
          checkin:    bookingDraft.checkin,
          checkout:   bookingDraft.checkout,
          guests:     bookingGuests,
          guestName:  bookingName.trim(),
          priceLevel: bookingDraft.hotel.priceLevel,
          nights,
          totalPrice,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      console.error('Stripe checkout error:', data.error);
    } catch (err) {
      console.error('Stripe fetch failed:', err);
    }

    // Fallback: go to dashboard if Stripe redirect didn't happen
    setBookingDraft(null);
    setBookingName('');
    setBookingGuests(1);
    router.push('/dashboard');
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

  const HotelList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching hotels...</p>;
    if (results.length === 0) return <p className="text-gray-600 mt-6">No results found. Try different search criteria.</p>;
    return (
      <div className="mt-6 space-y-4">
        {results.map(result => (
          <div key={result.id} className="flex bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition">
            {result.imageUrl ? (
              <img src={result.imageUrl} alt={result.name} className="w-44 h-36 object-cover shrink-0" />
            ) : (
              <div className="w-44 h-36 bg-gray-100 flex items-center justify-center shrink-0 text-4xl">🏨</div>
            )}
            <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 text-base leading-tight">{result.name}</h3>
                  {result.pricePerNight != null && result.pricePerNight > 0 && (
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold text-indigo-700">${result.pricePerNight}</p>
                      <p className="text-xs text-gray-500">per night</p>
                    </div>
                  )}
                </div>
                {result.rating != null && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-sm font-semibold text-gray-800">{result.rating}</span>
                    <span className="text-yellow-400 text-sm">
                      {'★'.repeat(Math.round(result.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(result.rating)))}
                    </span>
                    {result.reviewCount != null && (
                      <span className="text-xs text-gray-500">({result.reviewCount.toLocaleString()} reviews)</span>
                    )}
                  </div>
                )}
                {result.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{result.description}</p>
                )}
                {result.amenities && result.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.amenities.slice(0, 6).map(a => (
                      <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                {result.checkIn && <p className="text-xs text-gray-400">Check-in: {result.checkIn}</p>}
                <button
                  onClick={() => setBookingDraft({ hotel: result, checkin: formData.checkin, checkout: formData.checkout })}
                  className="ml-auto px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  Book Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const FlightList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching flights...</p>;
    if (results.length === 0) return <p className="text-gray-600 mt-6">No flights found. Try different airports or dates.</p>;
    const best  = results.filter(r => r.isBest);
    const other = results.filter(r => !r.isBest);
    const FlightRow = ({ r }: { r: SearchResult }) => {
      if (!r.legs?.length) return null;
      const first = r.legs[0];
      const last  = r.legs[r.legs.length - 1];
      const stops = r.legs.length - 1;
      const stopLabel = stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;
      const layoverInfo = r.layovers?.map(l => `${l.id} ${fmtDuration(l.duration)}${l.overnight ? ' overnight' : ''}`).join(', ');
      const airlines = [...new Set(r.legs.map(l => l.airline))].join(' + ');
      return (
        <div className="flex items-center bg-white rounded-xl border border-gray-200 px-4 py-3 hover:shadow-md transition gap-4">
          <img
            src={r.airlineLogo ?? first.airlineLogo}
            alt={first.airline}
            className="w-9 h-9 object-contain shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-base">{fmtTime(first.departure.time)}</span>
              <span className="text-gray-400 text-sm">–</span>
              <span className="font-bold text-gray-900 text-base">{fmtTime(last.arrival.time)}</span>
              <span className="text-xs text-gray-500 ml-1 font-medium">{first.departure.airport} → {last.arrival.airport}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
              <span>{airlines}</span>
              <span className="text-gray-300">|</span>
              <span>{fmtDuration(r.totalDuration ?? 0)}</span>
              <span className="text-gray-300">|</span>
              <span className={stops === 0 ? 'text-green-600 font-semibold' : 'text-orange-500 font-medium'}>
                {stopLabel}{layoverInfo ? ` · ${layoverInfo}` : ''}
              </span>
              <span className="text-gray-300">|</span>
              <span>{first.travelClass}</span>
            </div>
            {r.extensions && r.extensions.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{r.extensions.slice(0, 2).join(' · ')}</p>
            )}
          </div>
          <div className="text-right shrink-0 ml-4">
            <p className="text-xl font-bold text-indigo-700">${r.price?.toLocaleString()}</p>
            <p className="text-xs text-gray-500">per person</p>
          </div>
        </div>
      );
    };
    return (
      <div className="mt-6 space-y-2">
        {best.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Best flights</p>
            {best.map(r => <FlightRow key={r.id} r={r} />)}
          </>
        )}
        {other.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-5 mb-2">Other flights</p>
            {other.map(r => <FlightRow key={r.id} r={r} />)}
          </>
        )}
      </div>
    );
  };

  const ResultsGrid = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching...</p>;
    if (results.length === 0) return <p className="text-gray-600 mt-6">No results found. Try different search criteria.</p>;
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {results.map(result => (
          <div key={result.id} className="p-4 border border-gray-200 bg-white rounded-lg hover:shadow-lg transition flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-gray-900">{result.name}</h3>
              {result.priceLevel && (
                <span className="shrink-0 text-green-700 font-bold text-sm bg-green-50 px-2 py-0.5 rounded">
                  {result.priceLevel}
                </span>
              )}
            </div>
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
                <HotelList />
              </div>
            )}

            {/* Flights */}
            {activeTab === 'flights' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                    <input type="text" name="from" value={formData.from} onChange={handleInputChange} placeholder="City or airport code" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                    <input type="text" name="to" value={formData.to} onChange={handleInputChange} placeholder="City or airport code" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Depart</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Return <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="date" name="return" value={formData.return} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('flights')}
                </div>
                <FlightList />
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

        {/* Success toast */}
        {bookingSuccess && (
          <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg font-medium">
            ✓ Booking confirmed! View it in your dashboard.
          </div>
        )}

        {/* Booking modal */}
        {bookingDraft && (() => {
          const nights        = calcNights(bookingDraft.checkin, bookingDraft.checkout);
          const pricePerNight = bookingDraft.hotel.pricePerNight ?? PRICE_PER_NIGHT[bookingDraft.hotel.priceLevel ?? '$$'] ?? 160;
          const total         = pricePerNight * nights * bookingGuests;
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Book Hotel</h2>
                <p className="text-gray-600 text-sm mb-4">{bookingDraft.hotel.name}</p>

                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 space-y-1">
                  <p><span className="font-medium">Address:</span> {bookingDraft.hotel.description}</p>
                  <p><span className="font-medium">Check-in:</span> {bookingDraft.checkin || '—'}</p>
                  <p><span className="font-medium">Check-out:</span> {bookingDraft.checkout || '—'}</p>
                  {bookingDraft.hotel.priceLevel && <p><span className="font-medium">Price level:</span> {bookingDraft.hotel.priceLevel}</p>}
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input
                      type="text"
                      value={bookingName}
                      onChange={e => setBookingName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
                    <input
                      type="number"
                      value={bookingGuests}
                      onChange={e => setBookingGuests(Math.max(1, +e.target.value))}
                      min={1}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Price breakdown */}
                <div className="bg-indigo-50 rounded-lg p-3 mb-5 text-sm space-y-1">
                  <div className="flex justify-between text-gray-700">
                    <span>${pricePerNight}/night × {nights} night{nights > 1 ? 's' : ''}</span>
                    <span>${pricePerNight * nights}</span>
                  </div>
                  {bookingGuests > 1 && (
                    <div className="flex justify-between text-gray-700">
                      <span>× {bookingGuests} guests</span>
                      <span>${total}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-indigo-700 border-t border-indigo-200 pt-1 mt-1">
                    <span>Total estimate</span>
                    <span>${total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setBookingDraft(null)}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBooking}
                    disabled={!bookingName.trim()}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 transition"
                  >
                    {user ? 'Confirm Booking →' : 'Sign in to Book'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
