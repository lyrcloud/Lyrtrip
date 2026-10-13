'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import React from 'react';
import { useRouter } from 'next/navigation';
import AirportInput from '@/components/AirportInput';
import LocationMap from '@/components/LocationMap';
import LocationPicker from '@/components/LocationPicker';
import { calcNights } from '@/lib/bookings';
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

interface PassengerDetail {
  title: string;
  givenName: string;
  familyName: string;
  dob: string;
  gender: string;
  nationality: string;
  email: string;
  phone: string;
  passportNumber?: string;
  passportCountry?: string;
  passportExpiry?: string;
}

// What still needs fixing before a flight can be paid for; empty when the form is complete
// Only adult fares are searched, so every passenger must be 18+ on the day they fly
const ADULT_AGE = 18;

function ageOn(dob: string, on: string): number {
  const [by, bm, bd] = dob.split('-').map(Number);
  const [y, m, d] = on.slice(0, 10).split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

function passengerProblems(pax: PassengerDetail[], idDocsRequired?: boolean, departDate?: string): string[] {
  const travelDate = departDate || new Date().toISOString().slice(0, 10);
  return pax.flatMap((p, i) => {
    const missing: string[] = [];
    if (!p.givenName.trim()) missing.push('first name');
    if (!p.familyName.trim()) missing.push('last name');
    if (!p.dob) missing.push('date of birth');
    else if (ageOn(p.dob, travelDate) < ADULT_AGE) missing.push(`date of birth (must be ${ADULT_AGE}+ on the travel date — child and infant tickets can't be booked online yet)`);
    if (!/^[A-Z]{2}$/.test(p.nationality)) missing.push('nationality (2-letter code)');
    if (!/\S+@\S+\.\S+/.test(p.email)) missing.push('email');
    if (p.phone.replace(/\D/g, '').length < 7) missing.push('phone number');
    if (idDocsRequired || p.passportNumber?.trim()) {
      if (!p.passportNumber?.trim()) missing.push('passport number');
      if (!/^[A-Z]{2}$/.test(p.passportCountry ?? '')) missing.push('passport issuing country');
      if (!p.passportExpiry) missing.push('passport expiry date');
    }
    if (!missing.length) return [];
    return [`${pax.length > 1 ? `Passenger ${i + 1}: ` : ''}${missing.join(', ')}`];
  });
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
  // duffel booking fields
  duffelOfferId?: string;
  duffelPassengerIds?: string[];
  duffelPassengerCount?: number;
  duffelExpiresAt?: string;
  // SerpAPI hotel id; present when the hotel can be requested through Lyrtrip
  propertyToken?: string | null;
  // airline needs passport details for every passenger
  idDocsRequired?: boolean;
  // booked against the Duffel test environment with Stripe test cards
  testBooking?: boolean;
  totalPrice?: number;
  basePrice?: number;
  // placeholder result shown when no provider answered; not bookable
  demo?: boolean;
  // job-specific
  company?: string;
  jobLocation?: string;
  salary?: string;
  jobType?: string;
  postedAt?: string;
  benefits?: string[];
  applyLink?: string;
  via?: string;
  highlights?: { title: string; items: string[] }[];
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(datetime: string): string {
  return datetime?.split(' ')[1] ?? datetime ?? '';
}

interface HotelRequestDraft {
  hotel: SearchResult;
  checkin: string;
  checkout: string;
}

// Lyrtrip's margin on the hotel total; the server re-prices and applies the same rate
const HOTEL_MARKUP = 1.12;

interface FlightDraft {
  flight: SearchResult;
  from: string;
  to: string;
  depart: string;
}

interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface UberRideEstimate {
  productId: string;
  name: string;
  lowEstimate: number;
  highEstimate: number;
  currencyCode: string;
  duration: number;
  distance: number;
  surgeMultiplier: number;
  emoji: string;
  seats: string;
}

interface RideDraft {
  ride: UberRideEstimate;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupLabel: string;
  dropoffLabel: string;
}

interface TrainStation {
  name: string;
  code: string;
  tz: string;
  bus: boolean;
  schArr: string;
  schDep: string;
  arr?: string;
  dep?: string;
  arrCmnt?: string;
  depCmnt?: string;
  status: string;
  platform?: string;
}

interface TrainData {
  routeName: string;
  trainNum: string;
  trainID: string;
  lat: number;
  lon: number;
  heading: string;
  velocity: number;
  trainState: string;
  trainTimely: string;
  statusMsg: string;
  eventCode: string;
  eventName?: string;
  destCode: string;
  destName?: string;
  origCode: string;
  origName?: string;
  originTZ: string;
  updatedAt: string;
  lastValTS: string;
  alerts: string[];
  stations: TrainStation[];
}

interface FlixbusSegment {
  dep_offset: string;
  dep_name: string;
  arr_offset: string;
  arr_name: string;
  product_type: string;
  product: string;
}

interface FlixbusJourney {
  id: string;
  depOffset: string;
  arrOffset: string;
  depName: string;
  arrName: string;
  duration: string;
  changeovers: number;
  segments: FlixbusSegment[];
  deeplink: string;
  price: number | null;
  currency: string;
  additionalInfo: string | null;
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
  career: [
    { id: '1', name: 'Senior Software Engineer', company: 'Google', jobLocation: 'Remote / Mountain View, CA', salary: '$180,000–220,000/yr', jobType: 'Full-time', postedAt: '2 days ago', description: 'Build and scale distributed systems powering Google\'s core products.' },
    { id: '2', name: 'Product Manager', company: 'Meta', jobLocation: 'Menlo Park, CA', salary: '$150,000–190,000/yr', jobType: 'Full-time', postedAt: '1 day ago', description: 'Drive product strategy and execution for flagship consumer applications.' },
    { id: '3', name: 'UX Designer', company: 'Apple', jobLocation: 'Cupertino, CA', salary: '$130,000–160,000/yr', jobType: 'Full-time', postedAt: '3 days ago', description: 'Shape delightful user experiences across iOS and macOS platforms.' },
  ],
};

function searchService(service: string): Promise<SearchResult[]> {
  return new Promise(resolve => setTimeout(() => resolve(mockData[service] ?? []), 400));
}

const PENDING_BOOKING_KEY = 'lyrtrip_pending_booking';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('flights');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [flightSearchError, setFlightSearchError] = useState<string | null>(null);

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
    flightPassengers: 1,
    location: '',
    cruiseDays: '',
    cuisine: '',
    priceRange: 'Any',
    activityType: '',
    courseType: '',
    trainNum: '',
    jobTitle: '',
    industry: '',
    jobType: '',
    datePosted: '',
  });

  const [userLocation, setUserLocation] = useState({ lat: 40.7128, lng: -74.0060 });
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hotelDraft, setHotelDraft] = useState<HotelRequestDraft | null>(null);
  const [hotelForm, setHotelForm] = useState({ givenName: '', familyName: '', email: '', phone: '', adults: 1, roomPreference: '', specialRequests: '' });
  // Price the server quoted for a given dates/guests combination, when it differs from search
  const [hotelServerQuote, setHotelServerQuote] = useState<{ key: string; totalPrice: number } | null>(null);
  const [hotelSubmitting, setHotelSubmitting] = useState(false);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [flightDraft, setFlightDraft] = useState<FlightDraft | null>(null);
  const [flightPassengerName, setFlightPassengerName] = useState('');
  const [flightPassengers, setFlightPassengers] = useState(1);
  const [flightPassengerDetails, setFlightPassengerDetails] = useState<PassengerDetail[]>([]);
  const [flightBookingLoading, setFlightBookingLoading] = useState(false);
  const [flightBookingError, setFlightBookingError] = useState<string | null>(null);

  const [uberToken, setUberToken]     = useState<string | null>(null);
  const [uberProfile, setUberProfile] = useState<{ first_name?: string; last_name?: string; email?: string; picture?: string } | null>(null);
  const [uberProfileLoading, setUberProfileLoading] = useState(false);

  const [uberDropoff, setUberDropoff] = useState<LocationData | null>(null);
  const [uberPickupText, setUberPickupText] = useState('');
  const [uberCity, setUberCity] = useState('');
  const [uberPrices, setUberPrices] = useState<UberRideEstimate[]>([]);
  const [uberPriceLoading, setUberPriceLoading] = useState(false);
  const [uberPriceError, setUberPriceError] = useState<string | null>(null);
  const [rideDraft, setRideDraft] = useState<RideDraft | null>(null);
  const [riderName, setRiderName] = useState('');
  const [riderEmail, setRiderEmail] = useState('');
  const [rideBookingLoading, setRideBookingLoading] = useState(false);
  const [rideBookingError, setRideBookingError] = useState<string | null>(null);
  const [trainResults, setTrainResults] = useState<TrainData[]>([]);
  const [busJourneys, setBusJourneys] = useState<FlixbusJourney[]>([]);


  const locateUser = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      setLocationLoading(false);
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
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
  }, []);

  useEffect(() => { locateUser(); }, [locateUser]);

  // Location button: retry on error, otherwise toggle the map
  const handleLocationClick = () => {
    if (locationError) {
      locateUser();
      setShowLocationMap(true);
      return;
    }
    setShowLocationMap(v => !v);
  };

  // Reverse-geocode GPS to get a city label for the Uber header
  useEffect(() => {
    if (locationLoading || locationError) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${userLocation.lat},${userLocation.lng}&result_type=locality|administrative_area_level_1&key=${apiKey}`)
      .then(r => r.json())
      .then(data => {
        const comps = data.results?.[0]?.address_components ?? [];
        const city    = comps.find((c: {types: string[]}) => c.types.includes('locality'))?.long_name;
        const state   = comps.find((c: {types: string[]}) => c.types.includes('administrative_area_level_1'))?.short_name;
        const country = comps.find((c: {types: string[]}) => c.types.includes('country'))?.short_name;
        const label = [city ?? state, country].filter(Boolean).join(', ');
        if (label) setUberCity(label);
      })
      .catch(() => {});
  }, [userLocation, locationLoading, locationError]);

  const handleFetchUberPrices = () => {
    if (!uberDropoff) return;
    const lambdaBase = (process.env.NEXT_PUBLIC_UBER_LAMBDA_URL ?? '').replace(/\/$/, '');
    if (!lambdaBase) return;
    setUberPriceLoading(true);
    setUberPriceError(null);
    fetch(`${lambdaBase}/estimates?pickupLat=${userLocation.lat}&pickupLng=${userLocation.lng}&dropoffLat=${uberDropoff.lat}&dropoffLng=${uberDropoff.lng}`)
      .then(r => r.json())
      .then(data => {
        if (data.rides?.length) setUberPrices(data.rides);
        else setUberPriceError(data.error ?? 'No rides available for this route.');
      })
      .catch(() => setUberPriceError('Could not connect to Uber service.'))
      .finally(() => setUberPriceLoading(false));
  };

  // After login redirect back with ?booking=pending — auto-trigger Stripe
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('booking') !== 'pending') return;
    const raw = sessionStorage.getItem(PENDING_BOOKING_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      sessionStorage.removeItem(PENDING_BOOKING_KEY);
      // Strip the query param without a reload
      window.history.replaceState({}, '', '/');
      if (draft.type === 'flight') {
        const { type: _type, ...flightOnly } = draft;
        if (!flightOnly.flight?.duffelOfferId) return;
        const count = flightOnly.flight?.duffelPassengerCount ?? 1;
        const emptyPax: PassengerDetail = { title: 'mr', givenName: '', familyName: '', dob: '', gender: 'm', nationality: '', email: '', phone: '' };
        setActiveTab('flights');
        setTimeout(() => {
          setFlightDraft(flightOnly as FlightDraft);
          setFlightPassengerDetails(Array.from({ length: count }, () => ({ ...emptyPax })));
          setFlightPassengers(count);
        }, 100);
        return;
      }
      // Saved hotel drafts come from listing-only results, which are no longer
      // bookable here — just return the guest to the hotels tab.
      setActiveTab('hotels');
    } catch { /* ignore */ }
  }, [user]);

  // Read ?tab= URL param on mount (e.g. after Uber OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Load Uber OAuth token from localStorage on mount
  useEffect(() => {
    const token   = localStorage.getItem('uber_access_token');
    const expires = localStorage.getItem('uber_token_expires');
    if (!token || (expires && Date.now() >= Number(expires))) {
      localStorage.removeItem('uber_access_token');
      localStorage.removeItem('uber_token_expires');
      return;
    }
    setUberToken(token);
    const lambdaBase = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    if (!lambdaBase) return;
    setUberProfileLoading(true);
    fetch(`${lambdaBase}/api/uber/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (!data.error) setUberProfile(data); })
      .catch(() => {})
      .finally(() => setUberProfileLoading(false));
  }, []);

  const connectUber = () => {
    const clientId    = process.env.NEXT_PUBLIC_UBER_CLIENT_ID ?? '';
    const redirectUri = `${window.location.origin}/auth/uber/callback`;
    const scope       = 'profile eats.deliveries';
    window.location.href =
      `https://auth.uber.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scope)}&response_type=code`;
  };

  const disconnectUber = () => {
    localStorage.removeItem('uber_access_token');
    localStorage.removeItem('uber_token_expires');
    setUberToken(null);
    setUberProfile(null);
  };

  // Tab bar: sliding underline, keep active tab in view, arrow-key navigation
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const measure = () => {
      const el = tabRefs.current[activeTab];
      if (el) setTabIndicator({ left: el.offsetLeft + 12, width: el.offsetWidth - 24 });
    };
    measure();
    tabRefs.current[activeTab]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab]);

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tabs.findIndex(t => t.id === activeTab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id;
    switchTab(next);
    tabRefs.current[next]?.focus();
  };

  // Ripple from the click point on buttons
  const addRipple = (e: React.MouseEvent<HTMLElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - rect.left - size / 2}px`;
    dot.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove());
  };

  const switchTab = (tabId: string) => {
    setActiveTab(tabId);
    setResults([]);
    setTrainResults([]);
    setBusJourneys([]);
    setHasSearched(false);
    setUberDropoff(null);
    setUberPrices([]);
    setUberPriceError(null);
    setUberPickupText('');
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
        destinationLocation: formData.destinationLocation
          ? { lat: formData.destinationLocation.lat, lng: formData.destinationLocation.lng }
          : null,
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
        passengers: formData.flightPassengers || 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Flight search failed');
    setFlightSearchError(data.error ?? null);
    return (data.results ?? []) as SearchResult[];
  };


  const searchJobsViaApi = async (): Promise<SearchResult[]> => {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service:    'career',
        jobTitle:   formData.jobTitle  || null,
        location:   formData.location  || null,
        jobType:    formData.jobType   || null,
        datePosted: formData.datePosted || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Job search failed');
    return (data.results ?? []) as SearchResult[];
  };

  const searchTrainsViaApi = async (): Promise<TrainData[]> => {
    const base = 'https://api.amtraker.com/v2';
    const endpoint = formData.trainNum
      ? `${base}/trains/${formData.trainNum.trim()}`
      : `${base}/trains`;
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error(`Amtraker API returned ${res.status}`);
    const data: Record<string, TrainData[]> = await res.json();
    let trains: TrainData[] = Object.values(data).flat();
    if (!formData.trainNum) {
      const from = formData.from.toUpperCase().trim();
      const to   = formData.to.toUpperCase().trim();
      if (from) trains = trains.filter(t => t.origCode === from);
      if (to)   trains = trains.filter(t => t.destCode === to);
    }
    return trains;
  };

  const searchBusViaApi = async (): Promise<FlixbusJourney[]> => {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'bus',
        from:    formData.from,
        to:      formData.to,
        date:    formData.depart || null,
        adult:   1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bus search failed');
    return (data.results ?? []) as FlixbusJourney[];
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
      } else if (service === 'career') {
        const data = await searchJobsViaApi();
        setResults(data);
      } else if (service === 'train') {
        const data = await searchTrainsViaApi();
        setTrainResults(data);
      } else if (service === 'bus') {
        const data = await searchBusViaApi();
        setBusJourneys(data);
      } else {
        const data = await searchService(service);
        setResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setTrainResults([]);
      setBusJourneys([]);
    } finally {
      setLoading(false);
    }
  };

  const openHotelRequest = (hotel: SearchResult) => {
    setHotelDraft({ hotel, checkin: formData.checkin, checkout: formData.checkout });
    setHotelServerQuote(null);
    setHotelError(null);
    if (user && !hotelForm.email) {
      const [givenName = '', ...rest] = (user.name ?? '').split(' ');
      setHotelForm(f => ({ ...f, email: user.email ?? '', givenName: f.givenName || givenName, familyName: f.familyName || rest.join(' ') }));
    }
  };

  const hotelQuoteKey = (d: HotelRequestDraft) => `${d.checkin}|${d.checkout}|${hotelForm.adults}`;

  // Total shown to the guest: the server's quote when it has re-priced these dates, else the search price
  const hotelShownTotal = (d: HotelRequestDraft): number | null => {
    if (hotelServerQuote?.key === hotelQuoteKey(d)) return hotelServerQuote.totalPrice;
    const nights = calcNights(d.checkin, d.checkout);
    if (!d.hotel.pricePerNight || nights < 1) return null;
    return Math.ceil(Number((d.hotel.pricePerNight * nights * HOTEL_MARKUP * 100).toFixed(6))) / 100;
  };

  const submitHotelRequest = async () => {
    if (!hotelDraft) return;
    const today = new Date().toISOString().slice(0, 10);
    const missing: string[] = [];
    if (!hotelDraft.checkin || hotelDraft.checkin < today) missing.push('check-in date');
    if (!hotelDraft.checkout || hotelDraft.checkout <= hotelDraft.checkin) missing.push('check-out date (after check-in)');
    if (!hotelForm.givenName.trim()) missing.push('first name');
    if (!hotelForm.familyName.trim()) missing.push('last name');
    if (!/\S+@\S+\.\S+/.test(hotelForm.email)) missing.push('email');
    if (hotelForm.phone.replace(/\D/g, '').length < 7) missing.push('phone number');
    if (missing.length) { setHotelError(`Please complete: ${missing.join(', ')}`); return; }

    const quotedTotal = hotelShownTotal(hotelDraft);
    setHotelSubmitting(true);
    setHotelError(null);
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/api/hotel/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyToken:   hotelDraft.hotel.propertyToken,
          destination:     formData.destination || formData.destinationLocation?.address || '',
          checkin:         hotelDraft.checkin,
          checkout:        hotelDraft.checkout,
          adults:          hotelForm.adults,
          guest:           { givenName: hotelForm.givenName, familyName: hotelForm.familyName, email: hotelForm.email, phone: hotelForm.phone },
          roomPreference:  hotelForm.roomPreference,
          specialRequests: hotelForm.specialRequests,
          quotedTotal,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
      if (data.priceChanged) setHotelServerQuote({ key: hotelQuoteKey(hotelDraft), totalPrice: data.totalPrice });
      setHotelError(data.error ?? 'Could not start the booking. Please try again.');
    } catch {
      setHotelError('Could not connect to the booking service. Please try again.');
    } finally {
      setHotelSubmitting(false);
    }
  };

  const confirmFlightBooking = async () => {
    if (!flightDraft) return;
    if (!user) {
      sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify({ type: 'flight', ...flightDraft }));
      router.push('/login');
      return;
    }
    const f = flightDraft.flight;

    // Duffel booking path
    if (f.duffelOfferId) {
      const problems = passengerProblems(flightPassengerDetails, f.idDocsRequired, f.legs?.[0]?.departure.time || flightDraft.depart);
      if (problems.length) { setFlightBookingError(`Please complete: ${problems.join('; ')}`); return; }
      setFlightBookingLoading(true);
      setFlightBookingError(null);
      try {
        const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
        const res = await fetch(`${baseUrl}/api/flight/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            duffelOfferId:      f.duffelOfferId,
            duffelPassengerIds: f.duffelPassengerIds,
            passengers:         flightPassengerDetails,
            flightSummary: {
              legs:          f.legs,
              totalDuration: f.totalDuration,
              from:          flightDraft.from,
              to:            flightDraft.to,
              depart:        flightDraft.depart,
            },
          }),
        });
        const data = await res.json();
        if (data.url) { window.location.href = data.url; return; }
        setFlightBookingError(data.error ?? 'Booking failed. Please try again.');
      } catch {
        setFlightBookingError('Could not connect to booking service. Please try again.');
      } finally {
        setFlightBookingLoading(false);
      }
      return;
    }

    // Legacy SerpAPI path (no real PNR — keeps old Stripe flow)
    if (!flightPassengerName.trim()) return;
    if (!user) {
      sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify({ type: 'flight', ...flightDraft }));
      router.push('/login');
      return;
    }
    const first = f.legs?.[0];
    const last  = f.legs?.[f.legs.length - 1];
    const totalPrice = (f.price ?? 0) * flightPassengers;
    const routeLabel = `${first?.departure.airport ?? flightDraft.from} → ${last?.arrival.airport ?? flightDraft.to}`;
    const stops      = (f.legs?.length ?? 1) - 1;
    const stopLabel  = stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_STRIPE_LAMBDA_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName:  `${[...new Set(f.legs?.map(l => l.airline))].join(' + ')} · ${routeLabel}`,
          address:    `${stopLabel} · ${fmtDuration(f.totalDuration ?? 0)} · ${first?.travelClass ?? 'Economy'}`,
          checkin:    flightDraft.depart,
          checkout:   flightDraft.depart,
          guests:     flightPassengers,
          guestName:  flightPassengerName.trim(),
          nights:     1,
          totalPrice,
        }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
    } catch (err) {
      console.error('Stripe fetch failed:', err);
    }
    setFlightDraft(null);
    setFlightPassengerName('');
    setFlightPassengers(1);
    router.push('/dashboard');
  };

  const confirmRideBooking = async () => {
    if (!rideDraft || !riderName.trim()) return;
    if (!user) { router.push('/login'); return; }

    const lambdaBase = (process.env.NEXT_PUBLIC_UBER_LAMBDA_URL ?? '').replace(/\/$/, '');
    if (!lambdaBase) return;

    setRideBookingLoading(true);
    setRideBookingError(null);
    try {
      const { ride, pickupLat, pickupLng, dropoffLat, dropoffLng, pickupLabel, dropoffLabel } = rideDraft;
      const baseFare   = Math.round((ride.lowEstimate + ride.highEstimate) / 2);
      const serviceFee = Math.max(2, Math.round(baseFare * 0.1));
      const res = await fetch(`${lambdaBase}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideName: ride.name, productId: ride.productId,
          lowEstimate: ride.lowEstimate, highEstimate: ride.highEstimate,
          serviceFee,
          currencyCode: ride.currencyCode,
          pickupLabel, dropoffLabel,
          pickupLat, pickupLng, dropoffLat, dropoffLng,
          riderName: riderName.trim(),
          riderEmail: riderEmail.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }
      setRideBookingError(data.error ?? 'Booking failed. Please try again.');
    } catch {
      setRideBookingError('Could not connect to booking service.');
    } finally {
      setRideBookingLoading(false);
    }
  };

  const tabs = [
    { id: 'flights', icon: '✈️', label: 'Flights' },
    { id: 'shipping', icon: '📦', label: 'Shipping' },
    { id: 'hotels', icon: '🏨', label: 'Hotels' },
    { id: 'car', icon: '🚗', label: 'Car' },
    { id: 'bus', icon: '🚌', label: 'Bus' },
    { id: 'train', icon: '🚂', label: 'Train' },
    { id: 'cruise', icon: '🚢', label: 'Cruise' },
    { id: 'dash', icon: '🍔', label: 'Dash' },
    { id: 'tourism', icon: '🎒', label: 'Tourism' },
    { id: 'study', icon: '🎓', label: 'Study' },
    { id: 'career', icon: '💼', label: 'Jobs' },
  ];

  const inputClass = "w-full px-4 py-3 text-base text-gray-900 bg-gray-50 border border-gray-200 rounded-xl shadow-sm transition-all duration-200 placeholder:text-gray-400 hover:border-brand-300 hover:bg-white focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100";
  const uberClientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID ?? '';
  const searchBtn = (service: string, disabled = false) => (
    <div className="flex items-end">
      <button
        onClick={e => { addRipple(e); handleSearch(service); }}
        disabled={loading || disabled}
        className="relative w-full overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 text-base bg-brand-600 text-white font-bold rounded-xl shadow-md shadow-brand-600/25 transition-all duration-200 hover:bg-brand-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:bg-gray-400 disabled:shadow-none disabled:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
      >
        {loading ? (
          <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="h-5 w-5">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
        )}
        {loading ? 'Searching…' : 'Search'}
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
                      <p className="text-xl font-bold text-brand-700">${result.pricePerNight}</p>
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
                {result.demo ? (
                  <span className="ml-auto px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">Sample · not bookable</span>
                ) : result.propertyToken && result.pricePerNight ? (
                <button
                  onClick={() => openHotelRequest(result)}
                  className="ml-auto px-4 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition"
                >
                  Book
                </button>
                ) : (
                // No price to book against; hotel websites are only shown to admins
                <span className="ml-auto px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">Not bookable online</span>
                )}
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
    if (results.length === 0) return <p className="text-gray-600 mt-6">{flightSearchError ? `${flightSearchError}. Pick a city or airport from the suggestions.` : 'No flights found. Try different airports or dates.'}</p>;
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
          <div className="text-right shrink-0 ml-4 flex flex-col items-end gap-1">
            <p className="text-xl font-bold text-brand-700">${r.price?.toLocaleString()}</p>
            <p className="text-xs text-gray-500">per person</p>
            {r.demo ? (
              <span className="mt-1 px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">Sample · not bookable</span>
            ) : !r.duffelOfferId ? (
              // Listing-only result (no reservation system behind it): send the traveler to the provider
              <a
                href={`https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${formData.from} to ${formData.to} on ${formData.depart}${formData.return ? ` returning ${formData.return}` : ''}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 px-4 py-1.5 border border-brand-600 text-brand-700 text-sm font-semibold rounded-lg hover:bg-brand-50 transition"
              >
                View deal ↗
              </a>
            ) : (
            <button
              onClick={() => {
                const count = r.duffelPassengerCount ?? 1;
                const emptyPax: PassengerDetail = { title: 'mr', givenName: '', familyName: '', dob: '', gender: 'm', nationality: '', email: '', phone: '' };
                setFlightDraft({ flight: r, from: formData.from, to: formData.to, depart: formData.depart });
                setFlightPassengerDetails(Array.from({ length: count }, () => ({ ...emptyPax })));
                setFlightPassengerName('');
                setFlightPassengers(count);
                setFlightBookingError(null);
              }}
              className="mt-1 px-4 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition"
            >
              Select
            </button>
            )}
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

  const JobList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching jobs worldwide...</p>;
    if (results.length === 0) return <p className="text-gray-600 mt-6">No jobs found. Try different keywords or location.</p>;
    return (
      <div className="mt-6 space-y-4">
        {results.map(result => (
          <div key={result.id} className="flex bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition">
            {/* Company logo */}
            <div className="w-20 bg-gray-50 flex items-center justify-center p-3 shrink-0 border-r border-gray-100">
              {result.imageUrl ? (
                <img src={result.imageUrl} alt={result.company} className="w-14 h-14 object-contain rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-14 h-14 bg-brand-100 flex items-center justify-center text-3xl rounded-lg">💼</div>
              )}
            </div>
            <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{result.name}</h3>
                    <p className="text-sm text-brand-600 font-medium mt-0.5">{result.company}</p>
                    {result.jobLocation && <p className="text-xs text-gray-500">📍 {result.jobLocation}</p>}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    {result.salary && (
                      <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{result.salary}</span>
                    )}
                    {result.jobType && (
                      <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">{result.jobType}</span>
                    )}
                  </div>
                </div>
                {result.description && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{result.description}</p>
                )}
                {result.highlights && result.highlights.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.highlights.slice(0, 1).map(h => (
                      <div key={h.title}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h.title}</p>
                        <ul className="flex flex-wrap gap-1 mt-1">
                          {h.items.slice(0, 3).map((item, i) => (
                            <li key={i} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
                {result.benefits && result.benefits.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {result.benefits.map(b => (
                      <span key={b} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{b}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {result.postedAt && <span>🕐 {result.postedAt}</span>}
                  {result.via && <span>via {result.via}</span>}
                </div>
                {result.applyLink && (
                  <a
                    href={result.applyLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-1.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition"
                  >
                    Apply Now →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
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
              <p className="text-lg font-bold text-brand-600 mt-2">
                {result.currency && result.currency !== 'USD' ? result.currency + ' ' : '$'}
                {result.price.toLocaleString()}{result.unit ?? ''}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const TrainList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Looking up trains…</p>;
    if (trainResults.length === 0) return (
      <p className="text-gray-600 mt-6">No trains found. Try a train number (e.g. 2150) or station codes (e.g. WAS, NYP, CHI).</p>
    );

    const fmtT = (d?: string | null): string => {
      if (!d) return '—';
      try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
      catch { return '—'; }
    };

    return (
      <div className="mt-6 space-y-6">
        {trainResults.map(train => (
          <div key={train.trainID || train.trainNum} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <span className="text-2xl shrink-0">🚂</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900">{train.routeName}</h3>
                  <span className="text-sm text-gray-400">#{train.trainNum}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    train.trainState === 'Active'       ? 'bg-green-100 text-green-700' :
                    train.trainState === 'Predeparture' ? 'bg-blue-100 text-blue-700'  :
                                                          'bg-gray-100 text-gray-600'
                  }`}>{train.trainState}</span>
                  {train.trainTimely && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      train.trainTimely === 'On Time' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-700'
                    }`}>{train.trainTimely}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {train.origName || train.origCode} → {train.destName || train.destCode}
                </p>
              </div>
              {train.velocity > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-gray-900">{Math.round(train.velocity)} mph</p>
                  <p className="text-xs text-gray-400">{train.heading}</p>
                </div>
              )}
            </div>

            {/* Alerts banner */}
            {train.alerts?.length > 0 && (
              <div className="px-5 py-2 bg-amber-50 border-b border-amber-100">
                {train.alerts.map((alert, i) => (
                  <p key={i} className="text-sm text-amber-800">⚠️ {alert}</p>
                ))}
              </div>
            )}

            {/* Station timeline */}
            {train.stations.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Stops ({train.stations.length})
                </p>
                <div className="space-y-0">
                  {train.stations.map((st, i) => {
                    const passed    = !!st.dep;
                    const atStop    = !!st.arr && !st.dep;
                    const isCurrent = st.code === train.eventCode;
                    const isFirst   = i === 0;
                    const isLast    = i === train.stations.length - 1;
                    const cmnt      = st.depCmnt || st.arrCmnt;
                    return (
                      <div key={`${st.code}-${i}`} className="flex items-start gap-3">
                        <div className="flex flex-col items-center shrink-0 mt-1">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            passed    ? 'bg-gray-300' :
                            atStop    ? 'bg-green-500 ring-2 ring-green-200' :
                            isCurrent ? 'bg-brand-500 ring-2 ring-brand-200' :
                            'bg-white border-2 border-gray-300'
                          }`} />
                          {!isLast && <span className="w-px h-7 bg-gray-200 mt-0.5" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-sm font-bold ${passed ? 'text-gray-400' : 'text-gray-900'}`}>
                              {st.code}
                            </span>
                            {st.name && st.name !== st.code && (
                              <span className={`text-xs ${passed ? 'text-gray-300' : 'text-gray-500'}`}>{st.name}</span>
                            )}
                            {st.bus && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Bus</span>
                            )}
                            {atStop && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold">● At station</span>
                            )}
                            {isCurrent && !atStop && !passed && (
                              <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-semibold">Next stop</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs">
                            <span className="text-gray-400">
                              Sch:{' '}
                              {isFirst
                                ? fmtT(st.schDep)
                                : isLast
                                  ? fmtT(st.schArr)
                                  : `${fmtT(st.schArr)} / ${fmtT(st.schDep)}`}
                            </span>
                            {(st.arr || st.dep) && (
                              <span className="text-gray-700">
                                Act: {fmtT(st.arr || st.dep)}
                                {cmnt ? ` · ${cmnt}` : ''}
                              </span>
                            )}
                          </div>
                          {st.platform && (
                            <p className="text-xs text-brand-500 mt-0.5">Platform {st.platform}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-300 shrink-0 mt-1">{st.tz}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>Updated: {fmtT(train.updatedAt)}</span>
              {train.eventCode && (
                <span>At/next: <span className="font-semibold text-gray-600">{train.eventCode}{train.eventName ? ` — ${train.eventName}` : ''}</span></span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const BusList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching bus routes…</p>;
    if (busJourneys.length === 0) return (
      <p className="text-gray-600 mt-6">No routes found. Try different cities or date.</p>
    );

    const fmtT = (offset: string) => {
      try { return new Date(offset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
      catch { return offset; }
    };

    return (
      <div className="mt-6 space-y-3">
        <div className="flex items-center mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            {busJourneys.length} route{busJourneys.length !== 1 ? 's' : ''} found
          </span>
          <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
            <span className="w-4 h-4 bg-[#73D700] rounded-full inline-block" />
            Powered by Flixbus
          </span>
        </div>
        {busJourneys.map(j => (
          <div key={j.id} className="flex items-center bg-white rounded-xl border border-gray-200 px-4 py-4 hover:shadow-md transition gap-4">
            <span className="text-2xl shrink-0">🚌</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-base">{fmtT(j.depOffset)}</span>
                <span className="text-gray-400 text-sm">–</span>
                <span className="font-bold text-gray-900 text-base">{fmtT(j.arrOffset)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                <span className="truncate max-w-xs">{j.depName} → {j.arrName}</span>
                <span className="text-gray-300">|</span>
                <span>{j.duration}</span>
                <span className="text-gray-300">|</span>
                <span className={j.changeovers === 0 ? 'text-green-600 font-semibold' : 'text-orange-500 font-medium'}>
                  {j.changeovers === 0 ? 'Direct' : `${j.changeovers} changeover${j.changeovers > 1 ? 's' : ''}`}
                </span>
              </div>
              {j.segments.length > 1 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {j.segments.map((s, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {s.dep_name.split(' (')[0]} → {s.arr_name.split(' (')[0]}
                    </span>
                  ))}
                </div>
              )}
              {j.additionalInfo && (
                <p className="text-xs text-orange-500 mt-0.5 font-medium">⚠ {j.additionalInfo}</p>
              )}
            </div>
            <div className="text-right shrink-0 ml-4 flex flex-col items-end gap-1">
              {j.price != null && (
                <>
                  <p className="text-xl font-bold text-brand-700">{j.currency} {j.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">per person</p>
                </>
              )}
              <a
                href={j.deeplink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 px-4 py-1.5 bg-[#73D700] text-black text-sm font-semibold rounded-lg hover:opacity-90 transition"
              >
                Book on Flixbus →
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-linear-to-br from-brand-50 to-white">
      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">

        {/* Hero */}
        <div className="text-center mb-16">
          <button
            type="button"
            onClick={handleLocationClick}
            aria-expanded={showLocationMap}
            aria-controls="location-map"
            aria-busy={locationLoading}
            title={locationError ? 'Try locating you again' : showLocationMap ? 'Hide map' : 'Show my location on the map'}
            className="group relative inline-flex items-center gap-3 rounded-full bg-brand-600 py-3 pl-3 pr-6 text-base sm:text-lg font-bold text-white shadow-lg shadow-brand-600/30 transition-all duration-200 hover:bg-brand-700 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
          >
            {/* Pulse ring once the location is known, inviting a click */}
            {!showLocationMap && !locationLoading && !locationError && (
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-brand-400 animate-ping opacity-60" />
            )}
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              {showLocationMap ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                  className={`h-6 w-6 transition-transform duration-500 ${locationLoading ? 'animate-spin [animation-duration:2s]' : 'group-hover:rotate-[25deg] group-hover:scale-110'}`}
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18" />
                  <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
                </svg>
              )}
            </span>
            <span className="relative text-left leading-tight">
              <span className="block">
                {showLocationMap ? 'Hide Map' : locationLoading ? 'Locating…' : locationError ? 'Retry Location' : 'My Location'}
              </span>
              {!showLocationMap && !locationLoading && !locationError && uberCity && (
                <span className="block text-xs font-medium text-white/80">{uberCity}</span>
              )}
            </span>
          </button>
        </div>

        {/* Location Map */}
        {showLocationMap && (
          <div id="location-map" className="mb-12 bg-white rounded-lg shadow-lg p-6 animate-[mapIn_300ms_ease-out]">
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
        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-gray-100">
          {/* Tab Nav */}
          <div
            ref={tabBarRef}
            role="tablist"
            aria-label="Services"
            onKeyDown={onTabKeyDown}
            className="relative flex gap-1 border-b border-gray-100 overflow-x-auto px-2 pt-2 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)]"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={el => { tabRefs.current[tab.id] = el; }}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => switchTab(tab.id)}
                  className={`group shrink-0 flex flex-col sm:flex-row items-center gap-1 sm:gap-2 rounded-t-xl px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base font-bold whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-200 ${
                    isActive ? 'text-brand-600 bg-brand-50/70' : 'text-gray-600 hover:text-brand-600 hover:bg-gray-50'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`text-2xl sm:text-[1.6rem] leading-none transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}
                  >
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              );
            })}
            {/* Sliding underline under the active tab */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 h-1 rounded-full bg-brand-600 transition-all duration-300 ease-out"
              style={{ left: tabIndicator.left, width: tabIndicator.width }}
            />
          </div>

          {/* Forms */}
          <div key={activeTab} role="tabpanel" className="p-5 sm:p-8 animate-[panelIn_250ms_ease-out]">

            {/* Hotels */}
            {activeTab === 'hotels' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Destination</label>
                    <LocationPicker
                      onLocationSelect={(loc) => handleLocationSelect('destinationLocation', loc)}
                      placeholder="Select hotel location"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Check-in</label>
                    <input type="date" name="checkin" value={formData.checkin} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Check-out</label>
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
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">From</label>
                    <AirportInput name="from" value={formData.from} onChange={v => setFormData(prev => ({ ...prev, from: v }))} placeholder="City, airport or code" className={inputClass} />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">To</label>
                    <AirportInput name="to" value={formData.to} onChange={v => setFormData(prev => ({ ...prev, to: v }))} placeholder="City, airport or code" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Depart</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Return <span className="text-gray-400 font-normal">(opt.)</span></label>
                    <input type="date" name="return" value={formData.return} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Adults</label>
                    <input type="number" name="flightPassengers" value={formData.flightPassengers} onChange={e => setFormData(prev => ({ ...prev, flightPassengers: Math.max(1, Math.min(9, +e.target.value)) }))} min={1} max={9} className={inputClass} />
                  </div>
                  {searchBtn('flights')}
                </div>
                <FlightList />
              </div>
            )}

            {/* Car */}
            {activeTab === 'car' && (
              <div>
                <div>
                  {/* City header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>📍</span>
                      <span>{uberCity || 'Detecting location…'}</span>
                      {uberCity && (
                        <button onClick={() => setUberCity('')} className="text-xs text-black underline hover:no-underline ml-1">
                          Change city
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">U</span>
                      <span className="text-xs text-gray-400">Powered by Uber</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-3">Request a ride</h3>

                  <button className="mb-4 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-200 transition">
                    🕐 Pickup now ▾
                  </button>

                  {/* Location inputs */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50">
                      <span className="w-3 h-3 rounded-full bg-black shrink-0" />
                      <input
                        type="text"
                        value={uberPickupText}
                        onChange={e => setUberPickupText(e.target.value)}
                        placeholder={!locationLoading && !locationError ? '📍 Using your current location' : 'Enter location'}
                        className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
                      />
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50">
                      <span className="w-3 h-3 rounded-sm bg-black shrink-0" />
                      <div className="flex-1">
                        <LocationPicker
                          onLocationSelect={(loc) => { setUberDropoff(loc); setUberPrices([]); setUberPriceError(null); }}
                          placeholder="Enter destination"
                        />
                      </div>
                    </div>
                  </div>

                  {uberPriceError && <p className="text-sm text-red-500 mb-3">{uberPriceError}</p>}

                  <button
                    onClick={handleFetchUberPrices}
                    disabled={!uberDropoff || uberPriceLoading}
                    className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 disabled:bg-gray-300 transition mb-5"
                  >
                    {uberPriceLoading ? 'Getting prices…' : 'See prices'}
                  </button>

                  {/* Live price results */}
                  {uberPrices.length > 0 && (
                    <div className="space-y-3">
                      {uberPrices.map(ride => {
                        const baseFare   = Math.round((ride.lowEstimate + ride.highEstimate) / 2);
                        const serviceFee = Math.max(2, Math.round(baseFare * 0.1));
                        return (
                          <div key={ride.productId || ride.name} className="flex items-center bg-white border border-gray-200 rounded-xl px-4 py-3 hover:shadow-md transition">
                            <span className="text-3xl mr-3">{ride.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-900">{ride.name}</p>
                                <span className="text-xs text-gray-400">{ride.seats} seats</span>
                                {ride.surgeMultiplier > 1 && <span className="text-xs text-orange-500 font-semibold">⚡ {ride.surgeMultiplier}×</span>}
                              </div>
                              <p className="text-sm text-gray-500">
                                {ride.distance?.toFixed(1)} mi · ~{Math.round((ride.duration ?? 0) / 60)} min
                              </p>
                            </div>
                            <div className="text-right shrink-0 ml-3">
                              <p className="font-bold text-gray-900">${ride.lowEstimate}–${ride.highEstimate}</p>
                              <p className="text-xs text-gray-400">+${serviceFee} fee</p>
                              <button
                                onClick={() => {
                                  setRideDraft({ ride, pickupLat: userLocation.lat, pickupLng: userLocation.lng, dropoffLat: uberDropoff!.lat, dropoffLng: uberDropoff!.lng, pickupLabel: uberPickupText || 'Current location', dropoffLabel: uberDropoff!.address });
                                  setRiderName(''); setRiderEmail(''); setRideBookingError(null);
                                }}
                                className="mt-1 px-4 py-1.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition"
                              >
                                Book
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bus */}
            {activeTab === 'bus' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-[#73D700] rounded-full shrink-0" />
                    <span className="text-sm font-medium text-gray-600">Powered by Flixbus</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">From</label>
                    <input type="text" name="from" value={formData.from} onChange={handleInputChange} placeholder="Departure city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">To</label>
                    <input type="text" name="to" value={formData.to} onChange={handleInputChange} placeholder="Destination city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Depart</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('bus')}
                </div>
                <BusList />
              </div>
            )}

            {/* Train */}
            {activeTab === 'train' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Train # <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="number"
                      name="trainNum"
                      value={formData.trainNum}
                      onChange={handleInputChange}
                      placeholder="e.g. 2150"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">From</label>
                    <input
                      type="text"
                      name="from"
                      value={formData.from}
                      onChange={handleInputChange}
                      placeholder="Station code (WAS)"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">To</label>
                    <input
                      type="text"
                      name="to"
                      value={formData.to}
                      onChange={handleInputChange}
                      placeholder="Station code (NYP)"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('train')}
                </div>
                <TrainList />
              </div>
            )}

            {/* Cruise */}
            {activeTab === 'cruise' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Departure Port</label>
                    <input type="text" name="from" value={formData.from} onChange={handleInputChange} placeholder="Port city" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Departure Date</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (days)</label>
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
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>📍</span>
                    <span>{uberCity || 'Detecting location…'}</span>
                  </div>
                  {uberToken ? (
                    <div className="flex items-center gap-2">
                      {uberProfileLoading ? (
                        <div className="w-4 h-4 border-2 border-[#06C167] border-t-transparent rounded-full animate-spin" />
                      ) : uberProfile?.picture ? (
                        <img src={uberProfile.picture} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <span className="w-7 h-7 bg-[#06C167] rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {uberProfile?.first_name?.[0] ?? 'U'}
                        </span>
                      )}
                      <span className="text-sm text-gray-700 font-medium">
                        {uberProfile ? `${uberProfile.first_name ?? ''} ${uberProfile.last_name ?? ''}`.trim() : 'Connected'}
                      </span>
                      <button onClick={disconnectUber} className="text-xs text-gray-400 hover:text-red-500 underline ml-1">Disconnect</button>
                    </div>
                  ) : (
                    <button
                      onClick={connectUber}
                      className="flex items-center gap-2 px-4 py-1.5 bg-black text-white text-sm font-semibold rounded-full hover:bg-gray-800 transition"
                    >
                      <span className="w-5 h-5 bg-[#06C167] rounded-full flex items-center justify-center text-white text-xs font-bold">U</span>
                      Connect Uber
                    </button>
                  )}
                </div>

                {!uberToken && (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6 flex items-start gap-4">
                    <span className="text-3xl shrink-0">🚀</span>
                    <div>
                      <p className="font-semibold text-gray-900 mb-1">Connect your Uber account</p>
                      <p className="text-sm text-gray-500 mb-3">Sign in with Uber to order food and track deliveries in real time through Uber Eats.</p>
                      <button
                        onClick={connectUber}
                        className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition"
                      >
                        Sign in with Uber
                      </button>
                    </div>
                  </div>
                )}

                <h3 className="text-xl font-bold text-gray-900 mb-5">What are you craving?</h3>

                {/* Category cards — link to live Uber Eats when connected, internal pages otherwise */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    {
                      name: 'Restaurants',
                      desc: 'Food from thousands of local restaurants',
                      emoji: '🍽️',
                      liveHref: `https://www.ubereats.com/feed?pl=${userLocation.lat},${userLocation.lng}`,
                      localHref: '/dash/restaurants',
                    },
                    {
                      name: 'Grocery',
                      desc: 'Fresh groceries & everyday essentials',
                      emoji: '🛒',
                      liveHref: `https://www.ubereats.com/category/grocery?pl=${userLocation.lat},${userLocation.lng}`,
                      localHref: '/dash/grocery',
                    },
                    {
                      name: 'Pickup',
                      desc: 'Order ahead and skip the wait',
                      emoji: '🍱',
                      liveHref: `https://www.ubereats.com/category/pickup?pl=${userLocation.lat},${userLocation.lng}`,
                      localHref: '/dash/pickup',
                    },
                  ].map(opt => (
                    <div
                      key={opt.name}
                      onClick={() => {
                        if (uberToken) window.open(opt.liveHref, '_blank', 'noopener');
                        else router.push(opt.localHref);
                      }}
                      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#06C167] transition flex flex-col cursor-pointer"
                    >
                      <span className="text-3xl">{opt.emoji}</span>
                      <p className="font-bold text-gray-900 mt-3 text-lg">{opt.name}</p>
                      <p className="text-sm text-gray-500 mt-1 flex-1">{opt.desc}</p>
                      <div className="mt-4 py-2 rounded-lg bg-[#06C167] text-white text-sm font-semibold text-center">
                        {uberToken ? `Open Uber Eats →` : `Browse ${opt.name}`}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Search box */}
                <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50">
                  <span className="text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Search for food or restaurants…"
                    className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-400"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const q = (e.target as HTMLInputElement).value.trim();
                        if (!q) return;
                        if (uberToken) window.open(`https://www.ubereats.com/search?q=${encodeURIComponent(q)}&pl=${userLocation.lat},${userLocation.lng}`, '_blank', 'noopener');
                        else router.push(`/dash/restaurants?q=${encodeURIComponent(q)}`);
                      }
                    }}
                  />
                </div>

                {uberToken && (
                  <p className="text-xs text-gray-400 text-center mt-4">
                    Ordering via Uber Eats · {uberProfile?.email ?? ''}
                  </p>
                )}
              </div>
            )}

            {/* Tourism */}
            {activeTab === 'tourism' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Destination</label>
                    <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} placeholder="City or attraction" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Activity Type</label>
                    <input type="text" name="activityType" value={formData.activityType} onChange={handleInputChange} placeholder="E.g. Museum, Adventure" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                    <input type="date" name="depart" value={formData.depart} onChange={handleInputChange} className={inputClass} />
                  </div>
                  {searchBtn('tourism')}
                </div>
                <ResultsGrid />
              </div>
            )}

            {/* Study */}
            {activeTab === 'study' && (
              <div className="py-10 text-center">
                <p className="text-4xl mb-3">🎓</p>
                <h3 className="text-lg font-bold text-gray-900">Study is coming soon</h3>
                <p className="text-sm text-gray-600 mt-1">Find courses, schools and study-abroad programs right here on Lyrtrip.</p>
              </div>
            )}

            {/* Jobs (Career) */}
            {activeTab === 'career' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title / Keywords</label>
                    <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} placeholder="e.g. Software Engineer, Barista" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location <span className="text-gray-400 font-normal">(worldwide)</span></label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="City, country or Remote" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Job Type</label>
                    <select name="jobType" value={formData.jobType} onChange={handleInputChange} className={inputClass}>
                      <option value="">Any type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Date Posted</label>
                    <select name="datePosted" value={formData.datePosted} onChange={handleInputChange} className={inputClass}>
                      <option value="">Any time</option>
                      <option value="today">Today</option>
                      <option value="3days">Last 3 days</option>
                      <option value="week">Last week</option>
                      <option value="month">Last month</option>
                    </select>
                  </div>
                  {searchBtn('career')}
                </div>
                <JobList />
              </div>
            )}

            {/* Shipping */}
            {activeTab === 'shipping' && (
              <div className="py-10 text-center">
                <p className="text-4xl mb-3">📦</p>
                <h3 className="text-lg font-bold text-gray-900">Shipping is coming soon</h3>
                <p className="text-sm text-gray-600 mt-1">Send parcels and compare courier rates right here on Lyrtrip.</p>
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

        {/* Hotel booking request modal */}
        {hotelDraft && (() => {
          const d      = hotelDraft;
          const nights = d.checkin && d.checkout && d.checkout > d.checkin ? calcNights(d.checkin, d.checkout) : 0;
          const total  = nights ? hotelShownTotal(d) : null;
          const fee    = total != null ? Math.round((total - total / HOTEL_MARKUP) * 100) / 100 : null;
          const input  = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';
          const label  = 'block text-xs font-medium text-gray-600 mb-1';
          const setF   = (k: keyof typeof hotelForm, v: string | number) => { setHotelForm(f => ({ ...f, [k]: v })); setHotelError(null); };
          const setDate = (k: 'checkin' | 'checkout', v: string) => { setHotelDraft(h => h && { ...h, [k]: v }); setHotelError(null); };
          const close  = () => { setHotelDraft(null); setHotelError(null); };
          return (
            <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 px-4 py-6 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-auto">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900">Book Hotel</h2>
                    <p className="text-sm text-gray-600 truncate">{d.hotel.name}</p>
                  </div>
                  <button onClick={close} className="text-gray-400 hover:text-gray-600 text-2xl leading-none" aria-label="Close">&times;</button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div>
                    <label className={label}>Check-in <span className="text-red-500">*</span></label>
                    <input type="date" value={d.checkin} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate('checkin', e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={label}>Check-out <span className="text-red-500">*</span></label>
                    <input type="date" value={d.checkout} min={d.checkin || undefined} onChange={e => setDate('checkout', e.target.value)} className={input} />
                  </div>
                  <div>
                    <label className={label}>Guests</label>
                    <select value={hotelForm.adults} onChange={e => setF('adults', Number(e.target.value))} className={`${input} bg-white`}>
                      {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} adult{n > 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bg-brand-50 rounded-xl p-4 mb-4 text-sm">
                  {total != null ? (
                    <>
                      <div className="flex justify-between text-gray-600"><span>Room, {nights} night{nights !== 1 ? 's' : ''}, incl. taxes &amp; fees</span><span>${(total - (fee ?? 0)).toFixed(2)}</span></div>
                      <div className="flex justify-between text-gray-600 mt-1"><span>Lyrtrip service fee (12%)</span><span>${(fee ?? 0).toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold text-gray-900 text-base mt-2 pt-2 border-t border-brand-100"><span>Total</span><span>${total.toFixed(2)}</span></div>
                      {!hotelServerQuote && <p className="text-xs text-gray-500 mt-2">Estimated from today&apos;s rate; the exact price is checked before you pay.</p>}
                    </>
                  ) : (
                    <p className="text-gray-600">Choose your dates to see the price.</p>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={label}>First name <span className="text-red-500">*</span></label>
                      <input value={hotelForm.givenName} onChange={e => setF('givenName', e.target.value)} className={input} />
                    </div>
                    <div>
                      <label className={label}>Last name <span className="text-red-500">*</span></label>
                      <input value={hotelForm.familyName} onChange={e => setF('familyName', e.target.value)} className={input} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={label}>Email <span className="text-red-500">*</span></label>
                      <input type="email" value={hotelForm.email} onChange={e => setF('email', e.target.value)} className={input} />
                    </div>
                    <div>
                      <label className={label}>Phone <span className="text-red-500">*</span></label>
                      <input type="tel" value={hotelForm.phone} onChange={e => setF('phone', e.target.value)} placeholder="+1 415 555 2671" className={input} />
                    </div>
                  </div>
                  <div>
                    <label className={label}>Room preference</label>
                    <select value={hotelForm.roomPreference} onChange={e => setF('roomPreference', e.target.value)} className={`${input} bg-white`}>
                      <option value="">No preference</option>
                      <option value="1 king bed">1 king bed</option>
                      <option value="2 beds">2 beds</option>
                      <option value="Non-smoking">Non-smoking</option>
                      <option value="Accessible room">Accessible room</option>
                    </select>
                  </div>
                  <div>
                    <label className={label}>Special requests</label>
                    <textarea value={hotelForm.specialRequests} onChange={e => setF('specialRequests', e.target.value)} rows={2} maxLength={500}
                      placeholder="Late arrival, high floor…" className={input} />
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-4">
                  You pay Lyrtrip now. We book this room directly with the hotel and email your hotel confirmation number,
                  usually within 24 hours. If the hotel can&apos;t confirm, we refund you in full.
                </p>

                {hotelError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{hotelError}</div>
                )}

                <div className="flex gap-3">
                  <button onClick={close} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition">Cancel</button>
                  <button
                    onClick={submitHotelRequest}
                    disabled={hotelSubmitting}
                    className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:bg-gray-300 transition"
                  >
                    {hotelSubmitting ? 'Checking price…' : total != null ? `Pay $${total.toFixed(2)} →` : 'Continue'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Flight booking modal */}
        {flightDraft && (() => {
          const f     = flightDraft.flight;
          const first = f.legs?.[0];
          const last  = f.legs?.[f.legs.length - 1];
          const stops = (f.legs?.length ?? 1) - 1;
          const stopLabel = stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;

          // Duffel booking modal — full passenger details
          if (f.duffelOfferId) {
            const total     = f.totalPrice ?? ((f.price ?? 0) * flightPassengers);
            const updatePax = (idx: number, field: keyof PassengerDetail, val: string) => {
              setFlightPassengerDetails(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
            };
            return (
              <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 px-4 py-6 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Book Flight</h2>
                    <button onClick={() => setFlightDraft(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                  </div>

                  {/* Flight summary */}
                  <div className="bg-brand-50 rounded-xl p-4 mb-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-900 text-base">
                          {first?.departure.airport} → {last?.arrival.airport}
                        </p>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {first ? `${fmtTime(first.departure.time)} – ${fmtTime(last!.arrival.time)}` : flightDraft.depart}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {fmtDuration(f.totalDuration ?? 0)} · {stopLabel} · {[...new Set(f.legs?.map(l => l.airline))].join(' + ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-brand-700">${total.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">total · {flightPassengers} pax</p>
                        <p className="text-xs text-brand-500 mt-0.5">incl. taxes &amp; fees</p>
                      </div>
                    </div>
                  </div>

                  {/* Passenger forms */}
                  <div className="space-y-5 mb-5 max-h-[50vh] overflow-y-auto pr-1">
                    {flightPassengerDetails.map((pax, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3">
                        {flightPassengerDetails.length > 1 && (
                          <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Passenger {idx + 1}</p>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                            <select value={pax.title} onChange={e => updatePax(idx, 'title', e.target.value)}
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                              <option value="mr">Mr</option>
                              <option value="ms">Ms</option>
                              <option value="mrs">Mrs</option>
                              <option value="miss">Miss</option>
                              <option value="dr">Dr</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                            <input type="text" value={pax.givenName} onChange={e => updatePax(idx, 'givenName', e.target.value)}
                              placeholder="Given name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                          <input type="text" value={pax.familyName} onChange={e => updatePax(idx, 'familyName', e.target.value)}
                            placeholder="Family name" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                            <input type="date" value={pax.dob} onChange={e => updatePax(idx, 'dob', e.target.value)}
                              max={`${new Date().getFullYear() - ADULT_AGE}-${new Date().toISOString().slice(5, 10)}`}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                            <select value={pax.gender} onChange={e => updatePax(idx, 'gender', e.target.value)}
                              className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                              <option value="m">Male</option>
                              <option value="f">Female</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nationality <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(2-letter code, e.g. US, GB, CN)</span></label>
                          <input type="text" value={pax.nationality} onChange={e => updatePax(idx, 'nationality', e.target.value.toUpperCase().slice(0, 2))}
                            placeholder="US" maxLength={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(ticket will be sent here)</span></label>
                          <input type="email" value={pax.email} onChange={e => updatePax(idx, 'email', e.target.value)}
                            placeholder="passenger@email.com" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(add country code if not from your nationality)</span></label>
                          <input type="tel" value={pax.phone} onChange={e => updatePax(idx, 'phone', e.target.value)}
                            placeholder="+1 415 555 2671" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                        </div>
                        <div className="pt-1">
                          <p className="text-xs font-medium text-gray-600 mb-1">
                            Passport {f.idDocsRequired ? <span className="text-red-500">* required by the airline</span> : <span className="text-gray-400 font-normal">(optional)</span>}
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <input type="text" value={pax.passportNumber ?? ''} onChange={e => updatePax(idx, 'passportNumber', e.target.value.toUpperCase())}
                              placeholder="Number" aria-label="Passport number" className="col-span-3 sm:col-span-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                            <input type="text" value={pax.passportCountry ?? ''} onChange={e => updatePax(idx, 'passportCountry', e.target.value.toUpperCase().slice(0, 2))}
                              placeholder="Issued by (US)" maxLength={2} aria-label="Passport issuing country" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                            <input type="date" value={pax.passportExpiry ?? ''} onChange={e => updatePax(idx, 'passportExpiry', e.target.value)}
                              aria-label="Passport expiry date" title="Expiry date" className="col-span-2 sm:col-span-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {f.testBooking && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 mb-4">
                      <span className="font-semibold">Test mode:</span> this books a test ticket, not a real one. Pay with Stripe test card{' '}
                      <span className="font-mono font-semibold">4242 4242 4242 4242</span>, any future date, any CVC.
                    </div>
                  )}

                  {flightBookingError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                      {flightBookingError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => { setFlightDraft(null); setFlightBookingError(null); }}
                      className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition">
                      Cancel
                    </button>
                    <button
                      onClick={confirmFlightBooking}
                      disabled={flightBookingLoading}
                      className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:bg-gray-300 transition flex items-center justify-center gap-2"
                    >
                      {flightBookingLoading ? (
                        <><span className="animate-spin">⟳</span> Processing…</>
                      ) : user ? (
                        `Pay $${total.toLocaleString()} →`
                      ) : 'Sign in to Book'}
                    </button>
                  </div>
                  {!user && (
                    <p className="text-center text-xs text-gray-500 mt-2">
                      <button onClick={() => { sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify({ type: 'flight', ...flightDraft })); router.push('/login'); }} className="text-brand-600 underline">Sign in</button> to complete your booking
                    </p>
                  )}
                </div>
              </div>
            );
          }

          // Legacy (SerpAPI) modal — simple name + count
          const total = (f.price ?? 0) * flightPassengers;
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Book Flight</h2>
                <p className="text-gray-600 text-sm mb-4">
                  {[...new Set(f.legs?.map(l => l.airline))].join(' + ')}
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-gray-900">
                    {first && <><span>{fmtTime(first.departure.time)}</span><span className="text-gray-400">→</span><span>{fmtTime(last!.arrival.time)}</span></>}
                    <span className="ml-1 text-gray-500 font-normal text-xs">{first?.departure.airport} → {last?.arrival.airport}</span>
                  </div>
                  <p>{fmtDuration(f.totalDuration ?? 0)} · {stopLabel} · {first?.travelClass ?? 'Economy'}</p>
                </div>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input type="text" value={flightPassengerName} onChange={e => setFlightPassengerName(e.target.value)}
                      placeholder="Passenger name" className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passengers</label>
                    <input type="number" value={flightPassengers} onChange={e => setFlightPassengers(Math.max(1, +e.target.value))}
                      min={1} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                </div>
                <div className="bg-brand-50 rounded-lg p-3 mb-5 text-sm">
                  <div className="flex justify-between font-bold text-brand-700">
                    <span>Total</span><span>${total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setFlightDraft(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">Cancel</button>
                  <button onClick={confirmFlightBooking} disabled={!flightPassengerName.trim()}
                    className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-semibold hover:bg-brand-700 disabled:bg-gray-300 transition">
                    {user ? 'Confirm Booking →' : 'Sign in to Book'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Uber ride booking modal */}
        {rideDraft && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 bg-black rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">U</span>
                <h2 className="text-xl font-bold text-gray-900">Book Uber Ride</h2>
                <span className="ml-auto text-2xl">{rideDraft.ride.emoji}</span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 space-y-1">
                <p><span className="font-semibold">{rideDraft.ride.name}</span> · {rideDraft.ride.seats} seats</p>
                <p>📍 <span className="font-medium">From:</span> {rideDraft.pickupLabel}</p>
                <p>🏁 <span className="font-medium">To:</span> {rideDraft.dropoffLabel}</p>
                {rideDraft.ride.distance != null && (
                  <p>🛣️ {rideDraft.ride.distance.toFixed(1)} mi · ~{Math.round((rideDraft.ride.duration ?? 0) / 60)} min</p>
                )}
                {rideDraft.ride.surgeMultiplier > 1 && (
                  <p className="text-orange-500 font-semibold">⚡ Surge: {rideDraft.ride.surgeMultiplier}× active</p>
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                  <input type="text" value={riderName} onChange={e => setRiderName(e.target.value)} placeholder="Your name"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal">(for receipt)</span></label>
                  <input type="email" value={riderEmail} onChange={e => setRiderEmail(e.target.value)} placeholder="you@email.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>

              {(() => {
                const baseFare   = Math.round((rideDraft.ride.lowEstimate + rideDraft.ride.highEstimate) / 2);
                const serviceFee = Math.max(2, Math.round(baseFare * 0.1));
                const total      = baseFare + serviceFee;
                return (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Uber fare (est.)</span>
                      <span>${rideDraft.ride.lowEstimate}–${rideDraft.ride.highEstimate}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Lyrtrip service fee</span>
                      <span>${serviceFee}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
                      <span>Total charged now</span>
                      <span>~${total}</span>
                    </div>
                  </div>
                );
              })()}

              {rideBookingError && <p className="text-red-500 text-sm mb-3">{rideBookingError}</p>}

              <div className="flex gap-3">
                <button onClick={() => setRideDraft(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={confirmRideBooking} disabled={!riderName.trim() || rideBookingLoading}
                  className="flex-1 py-2 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition">
                  {rideBookingLoading ? 'Processing…' : user ? 'Pay via Stripe →' : 'Sign in to Book'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
