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

interface BookingDraft {
  hotel: SearchResult;
  checkin: string;
  checkout: string;
}

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

interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  courseState: string;
  alternateLink?: string;
}

interface ClassroomCourseWork {
  id: string;
  title: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  maxPoints?: number;
  workType: string;
  state: string;
  assigneeMode?: string;
  alternateLink?: string;
}

interface ClassroomStudent {
  userId: string;
  profile: {
    name: { fullName: string };
    emailAddress: string;
    photoUrl?: string;
  };
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
  study: [],
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
  const [bookingDraft, setBookingDraft] = useState<BookingDraft | null>(null);
  const [bookingName, setBookingName] = useState('');
  const [bookingGuests, setBookingGuests] = useState(1);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [flightDraft, setFlightDraft] = useState<FlightDraft | null>(null);
  const [flightPassengerName, setFlightPassengerName] = useState('');
  const [flightPassengers, setFlightPassengers] = useState(1);

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

  // Google Classroom state
  const [classroomToken, setClassroomToken] = useState<string | null>(null);
  const [classroomCourses, setClassroomCourses] = useState<ClassroomCourse[]>([]);
  const [classroomLoading, setClassroomLoading] = useState(false);
  const [classroomError, setClassroomError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<ClassroomCourse | null>(null);
  const [courseWork, setCourseWork] = useState<ClassroomCourseWork[]>([]);
  const [courseStudents, setCourseStudents] = useState<ClassroomStudent[]>([]);
  const [courseTab, setCourseTab] = useState<'coursework' | 'students'>('coursework');
  const [assigningWork, setAssigningWork] = useState<ClassroomCourseWork | null>(null);
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

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
    setTrainResults([]);
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

  // ---- Google Classroom helpers ----

  const classroomFetch = async (path: string, token: string) => {
    const res = await fetch(`https://classroom.googleapis.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Classroom API ${res.status}`);
    return res.json();
  };

  const connectClassroom = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const g = (window as any).google;
    if (!clientId || !g) {
      setClassroomError('Google client ID is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your environment.');
      return;
    }
    const tokenClient = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: [
        'https://www.googleapis.com/auth/classroom.courses.readonly',
        'https://www.googleapis.com/auth/classroom.coursework.students',
        'https://www.googleapis.com/auth/classroom.rosters.readonly',
      ].join(' '),
      callback: async (response: { access_token?: string; error?: string }) => {
        if (response.access_token) {
          setClassroomToken(response.access_token);
          await loadCourses(response.access_token);
        } else {
          setClassroomError(response.error ?? 'Sign-in cancelled');
        }
      },
    });
    tokenClient.requestAccessToken();
  };

  const loadCourses = async (token: string) => {
    setClassroomLoading(true);
    setClassroomError(null);
    try {
      const data = await classroomFetch('/courses?courseStates=ACTIVE&teacherId=me', token);
      setClassroomCourses(data.courses ?? []);
    } catch {
      setClassroomError('Failed to load courses. Make sure you have teacher access.');
    } finally {
      setClassroomLoading(false);
    }
  };

  const openCourse = async (course: ClassroomCourse) => {
    setSelectedCourse(course);
    setCourseTab('coursework');
    setCourseWork([]);
    setCourseStudents([]);
    if (!classroomToken) return;
    setClassroomLoading(true);
    try {
      const [cwData, stData] = await Promise.all([
        classroomFetch(`/courses/${course.id}/courseWork?courseWorkStates=PUBLISHED`, classroomToken),
        classroomFetch(`/courses/${course.id}/students`, classroomToken),
      ]);
      setCourseWork(cwData.courseWork ?? []);
      setCourseStudents(stData.students ?? []);
    } catch {
      setClassroomError('Failed to load course data.');
    } finally {
      setClassroomLoading(false);
    }
  };

  const toggleAssignStudent = (userId: string) => {
    setAssignStudentIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const confirmAssign = async () => {
    if (!assigningWork || !selectedCourse || !classroomToken || assignStudentIds.length === 0) return;
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(false);
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    try {
      const res = await fetch(`${baseUrl}/api/classroom/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          courseWorkId: assigningWork.id,
          studentIds: assignStudentIds,
          accessToken: classroomToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assign failed');
      setAssignSuccess(true);
      setTimeout(() => { setAssigningWork(null); setAssignStudentIds([]); setAssignSuccess(false); }, 2000);
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssignLoading(false);
    }
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
      } else {
        const data = await searchService(service);
        setResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setTrainResults([]);
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

  const confirmFlightBooking = async () => {
    if (!flightDraft || !flightPassengerName.trim()) return;

    if (!user) {
      sessionStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify({ type: 'flight', ...flightDraft }));
      router.push('/login');
      return;
    }

    const f = flightDraft.flight;
    const first = f.legs?.[0];
    const last  = f.legs?.[f.legs.length - 1];
    const totalPrice = (f.price ?? 0) * flightPassengers;
    const routeLabel = `${first?.departure.airport ?? flightDraft.from} → ${last?.arrival.airport ?? flightDraft.to}`;
    const timeLabel  = first ? `${fmtTime(first.departure.time)} → ${fmtTime(last!.arrival.time)}` : flightDraft.depart;
    const stops      = (f.legs?.length ?? 1) - 1;
    const stopLabel  = stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_STRIPE_LAMBDA_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName:  `${[...new Set(f.legs?.map(l => l.airline))].join(' + ')} · ${routeLabel}`,
          address:    `${timeLabel} · ${stopLabel} · ${fmtDuration(f.totalDuration ?? 0)} · ${first?.travelClass ?? 'Economy'}`,
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
      console.error('Stripe error:', data.error);
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
    { id: 'hotels',  label: '🏨 Hotels' },
    { id: 'flights', label: '✈️ Flights' },
    { id: 'car',     label: '🚗 Car' },
    { id: 'bus',     label: '🚌 Bus' },
    { id: 'train',   label: '🚂 Train' },
    { id: 'cruise',  label: '🚢 Cruise' },
    { id: 'dash',    label: '🍔 Dash' },
    { id: 'tourism', label: '🎒 Tourism' },
    { id: 'study',   label: '📚 Study' },
    { id: 'career',  label: '💼 Jobs' },
  ];

  const inputClass = "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent";
  const uberClientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID ?? '';
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
          <div className="text-right shrink-0 ml-4 flex flex-col items-end gap-1">
            <p className="text-xl font-bold text-indigo-700">${r.price?.toLocaleString()}</p>
            <p className="text-xs text-gray-500">per person</p>
            <button
              onClick={() => { setFlightDraft({ flight: r, from: formData.from, to: formData.to, depart: formData.depart }); setFlightPassengerName(''); setFlightPassengers(1); }}
              className="mt-1 px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              Select
            </button>
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

  const fmtDue = (d?: { year: number; month: number; day: number }) =>
    d ? `${d.month}/${d.day}/${d.year}` : null;

  const ClassroomView = () => {
    // Not yet connected
    if (!classroomToken) return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-6xl mb-5">📚</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Google Classroom</h2>
        <p className="text-gray-500 mb-6 max-w-sm">
          Connect your Google account to view and manage your courses, assignments, and students.
        </p>
        {classroomError && <p className="text-red-600 text-sm mb-4">{classroomError}</p>}
        <button
          onClick={connectClassroom}
          className="flex items-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-indigo-400 hover:shadow-md transition"
        >
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>
          Sign in with Google
        </button>
        <p className="text-xs text-gray-400 mt-4">Requires teacher access · Classroom scopes</p>
      </div>
    );

    // Loading courses or course detail
    if (classroomLoading && !selectedCourse) return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="animate-spin mr-3 w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
        Loading courses…
      </div>
    );

    if (classroomError) return (
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {classroomError}
        <button onClick={() => setClassroomError(null)} className="ml-4 underline text-xs">Dismiss</button>
      </div>
    );

    // Course detail view
    if (selectedCourse) return (
      <div className="mt-4">
        <button onClick={() => { setSelectedCourse(null); setCourseWork([]); setCourseStudents([]); }}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:underline mb-4">
          ← Back to Courses
        </button>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{selectedCourse.name}</h3>
            {selectedCourse.section && <p className="text-sm text-gray-500">Section: {selectedCourse.section}</p>}
          </div>
          {selectedCourse.alternateLink && (
            <a href={selectedCourse.alternateLink} target="_blank" rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline">Open in Classroom →</a>
          )}
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b mb-4 gap-1">
          {(['coursework', 'students'] as const).map(t => (
            <button key={t} onClick={() => setCourseTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize transition ${courseTab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {t} {t === 'coursework' ? `(${courseWork.length})` : `(${courseStudents.length})`}
            </button>
          ))}
        </div>

        {classroomLoading && <div className="text-gray-500 text-sm py-4">Loading…</div>}

        {/* Coursework list */}
        {courseTab === 'coursework' && !classroomLoading && (
          <div className="space-y-3">
            {courseWork.length === 0 && <p className="text-gray-500 text-sm">No published assignments found.</p>}
            {courseWork.map(cw => (
              <div key={cw.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{cw.workType?.replace(/_/g, ' ')}</span>
                      <h4 className="font-bold text-gray-900">{cw.title}</h4>
                    </div>
                    {cw.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cw.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                      {fmtDue(cw.dueDate) && <span>📅 Due {fmtDue(cw.dueDate)}</span>}
                      {cw.maxPoints != null && <span>🏆 {cw.maxPoints} pts</span>}
                      {cw.assigneeMode && <span>👥 {cw.assigneeMode.replace(/_/g, ' ')}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => { setAssigningWork(cw); setAssignStudentIds([]); setAssignError(null); setAssignSuccess(false); }}
                    className="shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                  >
                    Assign →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Students list */}
        {courseTab === 'students' && !classroomLoading && (
          <div className="space-y-2">
            {courseStudents.length === 0 && <p className="text-gray-500 text-sm">No students enrolled.</p>}
            {courseStudents.map(s => (
              <div key={s.userId} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
                {s.profile.photoUrl ? (
                  <img src={s.profile.photoUrl} alt={s.profile.name.fullName} className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                    {s.profile.name.fullName?.[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{s.profile.name.fullName}</p>
                  <p className="text-xs text-gray-400">{s.profile.emailAddress}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    // Course list view
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            My Courses ({classroomCourses.length})
          </p>
          <div className="flex gap-2">
            <button onClick={() => classroomToken && loadCourses(classroomToken)}
              className="text-sm text-indigo-600 hover:underline">Refresh</button>
            <button onClick={() => { setClassroomToken(null); setClassroomCourses([]); }}
              className="text-sm text-gray-400 hover:text-red-500">Disconnect</button>
          </div>
        </div>
        {classroomCourses.length === 0 && (
          <p className="text-gray-500 text-sm py-4">No active courses found. Make sure you have teacher access to at least one course.</p>
        )}
        <div className="space-y-3">
          {classroomCourses.map(course => (
            <div key={course.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:shadow-md transition">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-xl shrink-0">📖</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-gray-900 truncate">{course.name}</h3>
                  <p className="text-sm text-gray-500">
                    {[course.section, course.descriptionHeading].filter(Boolean).join(' · ') || 'Active'}
                  </p>
                </div>
              </div>
              <button onClick={() => openCourse(course)}
                className="shrink-0 ml-4 px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition">
                Open →
              </button>
            </div>
          ))}
        </div>
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
                <div className="w-14 h-14 bg-indigo-100 flex items-center justify-center text-3xl rounded-lg">💼</div>
              )}
            </div>
            <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{result.name}</h3>
                    <p className="text-sm text-indigo-600 font-medium mt-0.5">{result.company}</p>
                    {result.jobLocation && <p className="text-xs text-gray-500">📍 {result.jobLocation}</p>}
                  </div>
                  <div className="shrink-0 text-right flex flex-col items-end gap-1">
                    {result.salary && (
                      <span className="text-sm font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">{result.salary}</span>
                    )}
                    {result.jobType && (
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{result.jobType}</span>
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
                    className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
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
                            isCurrent ? 'bg-indigo-500 ring-2 ring-indigo-200' :
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
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">Next stop</span>
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
                            <p className="text-xs text-indigo-500 mt-0.5">Platform {st.platform}</p>
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
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
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
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>📍</span>
                    <span>{uberCity || 'Detecting location…'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-[#06C167] rounded-full flex items-center justify-center text-white text-xs font-bold">U</span>
                    <span className="text-xs text-gray-400">Powered by Uber Eats</span>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-5">What are you craving?</h3>

                {/* Category cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[
                    { name: 'Restaurants', desc: 'Food from thousands of local restaurants', emoji: '🍽️', href: '/dash/restaurants' },
                    { name: 'Grocery',     desc: 'Fresh groceries & everyday essentials',    emoji: '🛒', href: '/dash/grocery' },
                    { name: 'Pickup',      desc: 'Order ahead and skip the wait',            emoji: '🍱', href: '/dash/pickup' },
                  ].map(opt => (
                    <div
                      key={opt.name}
                      onClick={() => router.push(opt.href)}
                      className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#06C167] transition flex flex-col cursor-pointer"
                    >
                      <span className="text-3xl">{opt.emoji}</span>
                      <p className="font-bold text-gray-900 mt-3 text-lg">{opt.name}</p>
                      <p className="text-sm text-gray-500 mt-1 flex-1">{opt.desc}</p>
                      <div className="mt-4 py-2 rounded-lg bg-[#06C167] text-white text-sm font-semibold text-center">
                        Order {opt.name}
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
                        if (q) router.push(`/dash/restaurants?q=${encodeURIComponent(q)}`);
                      }
                    }}
                  />
                </div>
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

            {/* Study — Google Classroom */}
            {activeTab === 'study' && <ClassroomView />}

            {/* Assign modal */}
            {assigningWork && selectedCourse && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Assign to Students</h3>
                  <p className="text-sm text-gray-500 mb-4">{assigningWork.title}</p>

                  <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                    {courseStudents.length === 0 && (
                      <p className="text-sm text-gray-500">No students in this course.</p>
                    )}
                    {courseStudents.map(s => (
                      <label key={s.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" checked={assignStudentIds.includes(s.userId)}
                          onChange={() => toggleAssignStudent(s.userId)}
                          className="w-4 h-4 accent-indigo-600" />
                        {s.profile.photoUrl ? (
                          <img src={s.profile.photoUrl} alt={s.profile.name.fullName} className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                            {s.profile.name.fullName?.[0]}
                          </div>
                        )}
                        <span className="text-sm text-gray-800">{s.profile.name.fullName}</span>
                      </label>
                    ))}
                  </div>

                  {assignError && <p className="text-red-600 text-sm mb-3">{assignError}</p>}
                  {assignSuccess && <p className="text-green-600 text-sm mb-3">Assigned successfully!</p>}

                  <div className="flex gap-3">
                    <button onClick={() => { setAssigningWork(null); setAssignSuccess(false); setAssignError(null); }}
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                      Cancel
                    </button>
                    <button onClick={confirmAssign} disabled={assignLoading || assignStudentIds.length === 0 || assignSuccess}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition">
                      {assignLoading ? 'Assigning…' : `Assign ${assignStudentIds.length > 0 ? assignStudentIds.length : ''} Student${assignStudentIds.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Jobs (Career) */}
            {activeTab === 'career' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Title / Keywords</label>
                    <input type="text" name="jobTitle" value={formData.jobTitle} onChange={handleInputChange} placeholder="e.g. Software Engineer, Barista" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location <span className="text-gray-400 font-normal">(worldwide)</span></label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="City, country or Remote" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
                    <select name="jobType" value={formData.jobType} onChange={handleInputChange} className={inputClass}>
                      <option value="">Any type</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date Posted</label>
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

        {/* Flight booking modal */}
        {flightDraft && (() => {
          const f = flightDraft.flight;
          const first = f.legs?.[0];
          const last  = f.legs?.[f.legs.length - 1];
          const stops = (f.legs?.length ?? 1) - 1;
          const stopLabel = stops === 0 ? 'Nonstop' : `${stops} stop${stops > 1 ? 's' : ''}`;
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
                    <span className="ml-1 text-gray-500 font-normal text-xs">
                      {first?.departure.airport} → {last?.arrival.airport}
                    </span>
                  </div>
                  <p>{fmtDuration(f.totalDuration ?? 0)} · {stopLabel} · {first?.travelClass ?? 'Economy'}</p>
                  {f.extensions?.[0] && <p className="text-gray-500">{f.extensions.slice(0, 2).join(' · ')}</p>}
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input
                      type="text"
                      value={flightPassengerName}
                      onChange={e => setFlightPassengerName(e.target.value)}
                      placeholder="Enter passenger name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Passengers</label>
                    <input
                      type="number"
                      value={flightPassengers}
                      onChange={e => setFlightPassengers(Math.max(1, +e.target.value))}
                      min={1}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-lg p-3 mb-5 text-sm space-y-1">
                  <div className="flex justify-between text-gray-700">
                    <span>${f.price?.toLocaleString()} × {flightPassengers} passenger{flightPassengers > 1 ? 's' : ''}</span>
                    <span>${total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-indigo-700 border-t border-indigo-200 pt-1 mt-1">
                    <span>Total</span>
                    <span>${total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setFlightDraft(null)}
                    className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmFlightBooking}
                    disabled={!flightPassengerName.trim()}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 transition"
                  >
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
