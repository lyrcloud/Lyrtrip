'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AirportInput from '@/components/AirportInput';
import LocationMap from '@/components/LocationMap';
import LocationPicker from '@/components/LocationPicker';
import { calcNights } from '@/lib/bookings';
import { useAuth } from '@/context/AuthContext';
import { Price, useLocale } from '@/i18n/LocaleContext';
import HotelPriceCompare from '@/components/HotelPriceCompare';
import CheckoutExtras from '@/components/CheckoutExtras';
import ShippingTab from '@/components/ShippingTab';
import CourierDelivery from '@/components/CourierDelivery';
import RideBooking from '@/components/RideBooking';
import JobProfilePromo from '@/components/JobProfilePromo';
import JobApplyDialog, { type ApplyJob } from '@/components/JobApplyDialog';
import StudyApplyDialog, { type ApplyStudy } from '@/components/StudyApplyDialog';
import EventTicketDialog, { type TicketEvent } from '@/components/EventTicketDialog';
import TourRequestDialog, { type TourItem } from '@/components/TourRequestDialog';
import CharityPanel, { CHARITY_EVENT_TYPES } from '@/components/CharityPanel';
import HelicopterPanel from '@/components/HelicopterPanel';
import FreightPanel from '@/components/FreightPanel';
import LegalPanel from '@/components/LegalPanel';
import { getReferral, idTokenOrNull, type CheckoutExtrasValue, type RewardsQuote } from '@/lib/rewards';

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

// Google Flights' market read on a route (USD), used to show how a fare compares
interface PriceInsights {
  source: string;
  currency: string;
  lowestPrice: number;
  priceLevel: string | null;
  typicalLow: number | null;
  typicalHigh: number | null;
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
  // tourism: link from a government / embassy / official e-visa site
  official?: boolean;
  // events
  when?: string | null;
  startDate?: string | null;
  venue?: string | null;
  // study: 'place' = school/college from Maps, 'link' = admission/scholarship web result
  kind?: 'place' | 'link';
  placeType?: string | null;
  address?: string | null;
  website?: string | null;
  phone?: string | null;
  openState?: string | null;
  mapsLink?: string;
  source?: string | null;
  favicon?: string | null;
  // placeholder result shown when no provider answered; not bookable
  demo?: boolean;
  // job-specific
  company?: string;
  jobLocation?: string;
  salary?: string;
  jobType?: string;
  postedAt?: string;
  benefits?: string[];
  // sealed apply details: applicants apply through Lyrtrip, never straight to the employer
  applyToken?: string;
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
  // Set when ride booking is on: the Lyrtrip price (fare + fee) and the pickup wait
  price?: number;
  pickupMinutes?: number | null;
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
    { id: '1', name: 'Senior Software Engineer', jobLocation: 'Remote / Mountain View, CA', salary: '$180,000–220,000/yr', jobType: 'Full-time', postedAt: '2 days ago', description: 'Build and scale distributed systems powering core consumer products.' },
    { id: '2', name: 'Product Manager', jobLocation: 'Menlo Park, CA', salary: '$150,000–190,000/yr', jobType: 'Full-time', postedAt: '1 day ago', description: 'Drive product strategy and execution for flagship consumer applications.' },
    { id: '3', name: 'UX Designer', jobLocation: 'Cupertino, CA', salary: '$130,000–160,000/yr', jobType: 'Full-time', postedAt: '3 days ago', description: 'Shape delightful user experiences across iOS and macOS platforms.' },
  ],
};

function searchService(service: string): Promise<SearchResult[]> {
  return new Promise(resolve => setTimeout(() => resolve(mockData[service] ?? []), 400));
}

const PENDING_BOOKING_KEY = 'lyrtrip_pending_booking';

// Per-tab icon animations (Web Animations API), played on hover, click and arrow-key selection
type IconMotion = { frames: Keyframe[]; duration: number; easing?: string; puff?: string };
const ICON_MOTION: Record<string, IconMotion> = {
  flights: { duration: 1100, easing: 'ease-in-out', frames: [
    { transform: 'translate(0,0) rotate(0)', opacity: 1 },
    { transform: 'translate(8px,4px) rotate(4deg)', offset: 0.12 },
    { transform: 'translate(90px,-60px) rotate(-12deg) scale(0.7)', opacity: 0, offset: 0.45 },
    { transform: 'translate(-90px,50px) rotate(-12deg) scale(0.7)', opacity: 0, offset: 0.46 },
    { transform: 'translate(0,0) rotate(0)', opacity: 1 },
  ] },
  shipping: { duration: 800, easing: 'ease-out', frames: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-36px) rotate(-8deg)', offset: 0.3 },
    { transform: 'translateY(0) scale(1.15,0.85)', offset: 0.55 },
    { transform: 'translateY(-10px) scale(0.95,1.05)', offset: 0.75 },
    { transform: 'translateY(0) scale(1)' },
  ] },
  hotels: { duration: 800, easing: 'ease-out', frames: [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.3) translateY(-6px)', filter: 'brightness(1.3) drop-shadow(0 0 10px rgb(250 204 21))', offset: 0.4 },
    { transform: 'scale(0.95)', offset: 0.7 },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ] },
  car: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-3px) rotate(-2deg)', offset: 0.1 },
    { transform: 'translateX(3px) rotate(2deg)', offset: 0.2 },
    { transform: 'translateX(-3px)', offset: 0.3 },
    { transform: 'translateY(-14px) rotate(-6deg)', offset: 0.55 },
    { transform: 'translateY(0) scale(1.08,0.92)', offset: 0.8 },
    { transform: 'translateY(0) scale(1)' },
  ] },
  bus: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-8px) rotate(-3deg)', offset: 0.25 },
    { transform: 'translateY(0) rotate(2deg)', offset: 0.5 },
    { transform: 'translateY(-5px) rotate(-1deg)', offset: 0.75 },
    { transform: 'translateY(0) rotate(0)' },
  ] },
  train: { duration: 1000, easing: 'linear', puff: '💨', frames: [
    { transform: 'translate(0,0)' },
    { transform: 'translate(2px,-3px)', offset: 0.15 },
    { transform: 'translate(-2px,0)', offset: 0.3 },
    { transform: 'translate(2px,-3px)', offset: 0.45 },
    { transform: 'translate(-2px,0)', offset: 0.6 },
    { transform: 'translate(2px,-3px)', offset: 0.75 },
    { transform: 'translate(0,0)' },
  ] },
  cruise: { duration: 1200, easing: 'ease-in-out', puff: '🌊', frames: [
    { transform: 'rotate(0) translateY(0)' },
    { transform: 'rotate(-10deg) translateY(-4px)', offset: 0.25 },
    { transform: 'rotate(8deg) translateY(2px)', offset: 0.55 },
    { transform: 'rotate(-4deg) translateY(-2px)', offset: 0.8 },
    { transform: 'rotate(0) translateY(0)' },
  ] },
  dash: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'perspective(200px) rotateY(0) translateY(0)' },
    { transform: 'perspective(200px) rotateY(180deg) translateY(-18px)', offset: 0.45 },
    { transform: 'perspective(200px) rotateY(360deg) translateY(0) scale(1.1,0.9)', offset: 0.8 },
    { transform: 'perspective(200px) rotateY(360deg) scale(1)' },
  ] },
  tourism: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
    { transform: 'rotate(16deg)', transformOrigin: '50% 0%', offset: 0.25 },
    { transform: 'rotate(-12deg)', transformOrigin: '50% 0%', offset: 0.5 },
    { transform: 'rotate(6deg)', transformOrigin: '50% 0%', offset: 0.75 },
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
  ] },
  study: { duration: 1000, easing: 'ease-out', frames: [
    { transform: 'translateY(0) rotate(0)' },
    { transform: 'translateY(-44px) rotate(200deg)', offset: 0.45 },
    { transform: 'translateY(0) rotate(360deg) scale(1.1,0.9)', offset: 0.8 },
    { transform: 'translateY(0) rotate(360deg) scale(1)' },
  ] },
  events: { duration: 1000, easing: 'ease-out', puff: '🎉', frames: [
    { transform: 'rotate(0) scale(1)' },
    { transform: 'rotate(-18deg) scale(1.2) translateY(-6px)', offset: 0.3 },
    { transform: 'rotate(10deg) scale(1.1)', offset: 0.6 },
    { transform: 'rotate(0) scale(1)' },
  ] },
  charity: { duration: 1000, easing: 'ease-out', puff: '💚', frames: [
    { transform: 'scale(1)' },
    { transform: 'scale(1.25)', offset: 0.3 },
    { transform: 'scale(0.95)', offset: 0.55 },
    { transform: 'scale(1.1)', offset: 0.75 },
    { transform: 'scale(1)' },
  ] },
  taxlegal: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0)' },
    { transform: 'rotate(-12deg)', offset: 0.25 },
    { transform: 'rotate(10deg)', offset: 0.6 },
    { transform: 'rotate(0)' },
  ] },
  career: { duration: 800, easing: 'ease-in-out', frames: [
    { transform: 'rotate(0) scale(1)' },
    { transform: 'rotate(-12deg) scale(1.15)', offset: 0.2 },
    { transform: 'rotate(10deg) scale(1.15)', offset: 0.4 },
    { transform: 'rotate(-6deg) scale(1.1)', offset: 0.6 },
    { transform: 'rotate(0) scale(1)' },
  ] },
};

// Event types; the value is added to the search ("<keywords> <value> in <place>")
const EVENT_CATEGORIES: { group: string; items: [string, string][] }[] = [
  { group: 'Tech & IT', items: [
    ['IT technology conferences', 'IT & tech conferences'], ['AI artificial intelligence summits', 'AI summits'], ['generative AI machine learning conferences', 'GenAI & ML'],
    ['cloud computing DevOps conferences', 'Cloud & DevOps'], ['cybersecurity conferences', 'Cybersecurity'], ['data science analytics conferences', 'Data & analytics'],
    ['developer meetups hackathons', 'Developer meetups & hackathons'], ['startup events pitch nights', 'Startups & pitch nights'], ['blockchain web3 events', 'Blockchain & Web3'],
    ['fintech summits', 'Fintech'], ['semiconductor electronics expos', 'Semiconductors & electronics'],
  ] },
  { group: 'Summits & expos', items: [
    ['infrastructure summits', 'Infrastructure summits'], ['energy renewable climate summits', 'Energy & climate'], ['smart cities urban development summits', 'Smart cities'],
    ['real estate construction expos', 'Real estate & construction'], ['business leadership summits', 'Business & leadership'], ['investment finance summits', 'Investment & finance'],
    ['healthcare medical conferences', 'Healthcare & medical'], ['pharma biotech conferences', 'Pharma & biotech'], ['education edtech summits', 'Education & EdTech'],
    ['government policy summits', 'Government & policy'], ['automotive electric vehicle expos', 'Automotive & EV'], ['manufacturing industrial expos', 'Manufacturing & industry'],
    ['agriculture food processing expos', 'Agriculture & food'], ['travel tourism hospitality expos', 'Travel & hospitality'], ['trade shows expos', 'Trade shows & expos'],
    ['conferences', 'All conferences'],
  ] },
  { group: 'Sports', items: [
    ['sports events', 'All sports'], ['cricket matches', 'Cricket'], ['football soccer matches', 'Football'], ['tennis tournaments', 'Tennis'],
    ['basketball games', 'Basketball'], ['hockey matches', 'Hockey'], ['kabaddi matches', 'Kabaddi'], ['badminton tournaments', 'Badminton'],
    ['motorsport F1 races', 'Motorsport & F1'], ['marathons running events', 'Marathons & runs'], ['cycling events', 'Cycling'], ['golf tournaments', 'Golf'],
    ['boxing MMA wrestling fights', 'Boxing, MMA & wrestling'], ['esports gaming tournaments', 'Esports & gaming'], ['horse racing', 'Horse racing'],
  ] },
  { group: 'Entertainment', items: [
    ['concerts', 'Concerts'], ['festivals', 'Festivals'], ['comedy shows', 'Comedy'], ['theatre', 'Theatre'], ['nightlife', 'Nightlife'],
    ['food and drink events', 'Food & drink'], ['exhibitions', 'Exhibitions & art'], ['film screenings festivals', 'Film'],
  ] },
  { group: 'Charity & giving', items: CHARITY_EVENT_TYPES },
  { group: 'Local & community', items: [
    ['local community events', 'Community events'], ['cultural festivals', 'Cultural festivals'], ['religious spiritual events', 'Religious & spiritual'],
    ['workshops classes', 'Workshops & classes'], ['networking events', 'Networking'], ['family events', 'Family & kids'],
  ] },
];
const EVENT_QUICK: [string, string][] = [
  ['IT technology conferences', '💻 IT'], ['AI artificial intelligence summits', '🤖 AI summits'], ['infrastructure summits', '🏗️ Infra summits'],
  ['business leadership summits', '📈 Business summits'], ['sports events', '🏏 Sports'], ['concerts', '🎵 Concerts'], ['local community events', '📍 Local'],
];

// Pilgrimages under Religious Tours; ids match PILGRIMAGES in the search Lambda
const PILGRIMAGE_GROUPS: { faith: string; items: [string, string, string][] }[] = [
  { faith: 'Islam', items: [['hajj', '🕋', 'Hajj'], ['umrah', '🕋', 'Umrah'], ['ziyarat', '🕌', 'Ziyarat: Karbala, Najaf, Mashhad']] },
  { faith: 'Christian', items: [['holyland', '✝️', 'Holy Land'], ['vatican', '⛪', 'Rome & Vatican'], ['marian', '⛪', 'Lourdes, Fátima, Medjugorje'], ['camino', '🥾', 'Camino de Santiago']] },
  { faith: 'Hindu', items: [['chardham', '🛕', 'Char Dham'], ['kashi', '🛕', 'Varanasi & Ayodhya'], ['vaishno', '🛕', 'Vaishno Devi'], ['tirupati', '🛕', 'Tirupati'], ['amarnath', '🏔️', 'Amarnath'], ['kailash', '🏔️', 'Kailash Mansarovar']] },
  { faith: 'Buddhist', items: [['buddhist', '☸️', 'Bodh Gaya & Lumbini']] },
  { faith: 'Sikh', items: [['sikh', '🪯', 'Golden Temple, Kartarpur, Hemkund']] },
  { faith: 'Jain', items: [['jain', '🛕', 'Palitana & Shikharji']] },
  { faith: 'Jewish', items: [['jewish', '✡️', 'Jerusalem & Western Wall']] },
  { faith: 'Other', items: [['other', '🙏', 'Another shrine or temple']] },
];

// Tourism categories, shown as animated option tiles inside the Tourism tab
const TOUR_OPTIONS: { id: string; icon: string; label: string; motion: IconMotion }[] = [
  { id: 'tour-id', icon: '🪪', label: 'ID Card', motion: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'perspective(200px) rotateY(0)' },
    { transform: 'perspective(200px) rotateY(180deg) scale(1.15)', offset: 0.5 },
    { transform: 'perspective(200px) rotateY(360deg)' },
  ] } },
  { id: 'tour-passport', icon: '🛂', label: 'Passport', motion: { duration: 700, easing: 'ease-out', frames: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-18px) scale(1.1)', offset: 0.35 },
    { transform: 'translateY(2px) scale(1.25,0.8)', offset: 0.55 },
    { transform: 'translateY(0) scale(1)' },
  ] } },
  { id: 'tour-visa', icon: '📝', label: 'Visa', motion: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'translate(0,0) rotate(0)' },
    { transform: 'translate(-4px,2px) rotate(-8deg)', offset: 0.2 },
    { transform: 'translate(4px,-2px) rotate(6deg)', offset: 0.4 },
    { transform: 'translate(-3px,2px) rotate(-6deg)', offset: 0.6 },
    { transform: 'translate(3px,-1px) rotate(4deg)', offset: 0.8 },
    { transform: 'translate(0,0) rotate(0)' },
  ] } },
  { id: 'tour-insurance', icon: '🛡️', label: 'Insurance', motion: { duration: 900, easing: 'ease-out', puff: '✨', frames: [
    { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 transparent)' },
    { transform: 'scale(1.25)', filter: 'drop-shadow(0 0 10px rgb(59 130 246))', offset: 0.4 },
    { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 transparent)' },
  ] } },
  { id: 'tour-destination', icon: '🗺️', label: 'Destinations', motion: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'scaleX(1)' },
    { transform: 'scaleX(0.2)', offset: 0.3 },
    { transform: 'scaleX(1.15)', offset: 0.7 },
    { transform: 'scaleX(1)' },
  ] } },
  { id: 'tour-pack', icon: '🧳', label: 'Tour Packages', motion: { duration: 900, easing: 'ease-in-out', frames: [
    { transform: 'translateX(0) rotate(0)' },
    { transform: 'translateX(-10px) rotate(-10deg)', offset: 0.25 },
    { transform: 'translateX(10px) rotate(10deg)', offset: 0.6 },
    { transform: 'translateX(0) rotate(0)' },
  ] } },
  { id: 'tour-family', icon: '👨‍👩‍👧', label: 'Family Holidays', motion: { duration: 900, easing: 'ease-out', puff: '❤️', frames: [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-16px)', offset: 0.3 },
    { transform: 'translateY(0) scale(1.1,0.9)', offset: 0.5 },
    { transform: 'translateY(-8px)', offset: 0.7 },
    { transform: 'translateY(0) scale(1)' },
  ] } },
  { id: 'tour-vacation', icon: '🏖️', label: 'Vacation', motion: { duration: 1100, easing: 'ease-in-out', puff: '☀️', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
    { transform: 'rotate(-8deg)', transformOrigin: '50% 100%', offset: 0.3 },
    { transform: 'rotate(6deg)', transformOrigin: '50% 100%', offset: 0.65 },
    { transform: 'rotate(0)', transformOrigin: '50% 100%' },
  ] } },
  { id: 'tour-regional', icon: '🧭', label: 'Regional Tours', motion: { duration: 1100, easing: 'cubic-bezier(.3,1.4,.5,1)', frames: [
    { transform: 'rotate(0)' },
    { transform: 'rotate(380deg)', offset: 0.7 },
    { transform: 'rotate(360deg)' },
  ] } },
  { id: 'tour-educational', icon: '📚', label: 'Educational Tours', motion: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'perspective(200px) rotateX(0) translateY(0)' },
    { transform: 'perspective(200px) rotateX(-40deg) translateY(-10px)', offset: 0.4 },
    { transform: 'perspective(200px) rotateX(0) translateY(0)' },
  ] } },
  { id: 'tour-religious', icon: '🙏', label: 'Religious Tours', motion: { duration: 1100, easing: 'ease-in-out', puff: '✨', frames: [
    { transform: 'scale(1)', filter: 'brightness(1)' },
    { transform: 'scale(1.15)', filter: 'brightness(1.25) drop-shadow(0 0 10px rgb(250 204 21))', offset: 0.5 },
    { transform: 'scale(1)', filter: 'brightness(1)' },
  ] } },
  { id: 'tour-govt', icon: '🏛️', label: 'Government Tours', motion: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'translateY(24px) scaleY(0.3)', opacity: 0, transformOrigin: '50% 100%' },
    { transform: 'translateY(0) scaleY(1.1)', opacity: 1, transformOrigin: '50% 100%', offset: 0.6 },
    { transform: 'translateY(0) scaleY(1)', transformOrigin: '50% 100%' },
  ] } },
  { id: 'tour-adventure', icon: '🧗', label: 'Adventure', motion: { duration: 1000, easing: 'ease-in-out', frames: [
    { transform: 'translate(0,0)' },
    { transform: 'translate(-4px,-8px) rotate(-6deg)', offset: 0.25 },
    { transform: 'translate(4px,-16px) rotate(6deg)', offset: 0.5 },
    { transform: 'translate(0,-6px)', offset: 0.75 },
    { transform: 'translate(0,0)' },
  ] } },
  { id: 'tour-honeymoon', icon: '💑', label: 'Honeymoon', motion: { duration: 1000, easing: 'ease-in-out', puff: '💕', frames: [
    { transform: 'scale(1)' },
    { transform: 'scale(1.2)', offset: 0.2 },
    { transform: 'scale(1)', offset: 0.4 },
    { transform: 'scale(1.2)', offset: 0.6 },
    { transform: 'scale(1)' },
  ] } },
];
for (const o of TOUR_OPTIONS) ICON_MOTION[o.id] = o.motion;

// Countries covered by the visa-requirement data (ISO 3166 alpha-2), sorted by English name
const COUNTRY_CODES = 'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW'.split(' ');
const COUNTRIES = (() => {
  let names: Intl.DisplayNames | null = null;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* very old browser: show codes */ }
  return COUNTRY_CODES.map(code => ({ code, name: names?.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
})();

// Study options, shown as animated option tiles inside the Study tab
const STUDY_OPTIONS: { id: string; icon: string; label: string; blurb: string; motion: IconMotion }[] = [
  { id: 'study-academy', icon: '🏫', label: 'Academy', blurb: 'Browse schools, colleges and academies around the world.', motion: { duration: 900, easing: 'ease-out', frames: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-10px) scale(1.15)', offset: 0.3 },
    { transform: 'translateY(0) rotate(-5deg)', offset: 0.55 },
    { transform: 'rotate(4deg)', offset: 0.75 },
    { transform: 'rotate(0) scale(1)' },
  ] } },
  { id: 'study-admission', icon: '📬', label: 'Admission', blurb: 'Apply to programs and track your admission status in one place.', motion: { duration: 900, easing: 'ease-out', puff: '✉️', frames: [
    { transform: 'translateY(0) scale(1)' },
    { transform: 'translateY(-8px) scale(1.1,0.9)', offset: 0.25 },
    { transform: 'translateY(0) scale(0.95,1.08)', offset: 0.5 },
    { transform: 'translateY(0) scale(1)' },
  ] } },
  { id: 'study-scholarship', icon: '🏅', label: 'Scholarship', blurb: 'Find scholarships and funding that match your goals.', motion: { duration: 1100, easing: 'ease-in-out', puff: '✨', frames: [
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
    { transform: 'rotate(20deg) scale(1.1)', transformOrigin: '50% 0%', offset: 0.25 },
    { transform: 'rotate(-14deg) scale(1.1)', transformOrigin: '50% 0%', offset: 0.5 },
    { transform: 'rotate(6deg)', transformOrigin: '50% 0%', offset: 0.75 },
    { transform: 'rotate(0)', transformOrigin: '50% 0%' },
  ] } },
];
for (const o of STUDY_OPTIONS) ICON_MOTION[o.id] = o.motion;
// Option tiles under a group tile reuse their tab's motion, keyed apart from the group tiles' own icons
for (const k of Object.keys(ICON_MOTION)) ICON_MOTION[`sub-${k}`] = ICON_MOTION[k];

export default function Home() {
  const { user } = useAuth();
  const { t, money, original } = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('flights');
  // Stay tab: the kind of property to search for
  const [stayType, setStayType] = useState('hotels');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [applyJob, setApplyJob] = useState<ApplyJob | null>(null);
  const [openJobs, setOpenJobs] = useState<Record<string, boolean>>({});
  const [applyStudy, setApplyStudy] = useState<ApplyStudy | null>(null);
  const [applyEvent, setApplyEvent] = useState<TicketEvent | null>(null);
  const [bookTour, setBookTour] = useState<TourItem | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [flightSearchError, setFlightSearchError] = useState<string | null>(null);
  const [priceInsights, setPriceInsights] = useState<PriceInsights | null>(null);

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
  // Coupon, gift card and points for whichever booking modal is open
  const [extras, setExtras] = useState<CheckoutExtrasValue>({ couponCode: '', giftCardCode: '', usePoints: false });
  const [extrasQuote, setExtrasQuote] = useState<RewardsQuote | null>(null);
  const [hotelSubmitting, setHotelSubmitting] = useState(false);
  const [hotelError, setHotelError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [flightDraft, setFlightDraft] = useState<FlightDraft | null>(null);
  const [flightPassengerName, setFlightPassengerName] = useState('');
  const [flightPassengers, setFlightPassengers] = useState(1);
  const [flightPassengerDetails, setFlightPassengerDetails] = useState<PassengerDetail[]>([]);
  const [flightBookingLoading, setFlightBookingLoading] = useState(false);
  const [flightBookingError, setFlightBookingError] = useState<string | null>(null);


  const [uberDropoff, setUberDropoff] = useState<LocationData | null>(null);
  // null: the device's current location
  const [uberPickup, setUberPickup] = useState<LocationData | null>(null);
  const [uberPickerKey, setUberPickerKey] = useState(0);
  const [uberCity, setUberCity] = useState('');
  const [uberPrices, setUberPrices] = useState<UberRideEstimate[]>([]);
  const [uberPriceLoading, setUberPriceLoading] = useState(false);
  const [uberPriceError, setUberPriceError] = useState<string | null>(null);
  const [rideDraft, setRideDraft] = useState<RideDraft | null>(null);
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

  // Reverse-geocode GPS to get a city label for the ride and courier headers
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

  const ridePickup = uberPickup ?? { ...userLocation, address: 'Current location' };

  // Live, bookable prices when ride booking is on; otherwise typical-rate estimates
  const handleFetchUberPrices = async () => {
    if (!uberDropoff) return;
    const searchBase = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const lambdaBase = (process.env.NEXT_PUBLIC_UBER_LAMBDA_URL ?? '').replace(/\/$/, '');
    setUberPriceLoading(true);
    setUberPriceError(null);
    try {
      const live = await fetch(`${searchBase}/api/ride/estimate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup: { lat: ridePickup.lat, lng: ridePickup.lng, label: ridePickup.address }, dropoff: { lat: uberDropoff.lat, lng: uberDropoff.lng, label: uberDropoff.address } }),
      }).then(r => r.json()).catch(() => null);
      if (live?.enabled) {
        if (live.rides?.length) {
          setUberPrices(live.rides.map((r: UberRideEstimate & { currency: string; price: number }) => ({
            ...r, lowEstimate: r.price, highEstimate: r.price, currencyCode: r.currency, surgeMultiplier: 1,
          })));
        } else setUberPriceError(live.error ?? 'No rides are available for this trip right now.');
        return;
      }
      if (!lambdaBase) return;
      const data = await fetch(`${lambdaBase}/estimates?pickupLat=${ridePickup.lat}&pickupLng=${ridePickup.lng}&dropoffLat=${uberDropoff.lat}&dropoffLng=${uberDropoff.lng}`).then(r => r.json());
      if (data.rides?.length) setUberPrices(data.rides);
      else setUberPriceError(data.error ?? 'No rides available for this route.');
    } catch {
      setUberPriceError('Could not get ride prices. Please try again.');
    } finally {
      setUberPriceLoading(false);
    }
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

  // Read ?tab= URL param on mount (links from the dashboard and receipts)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Flight form: trip type, From/To swap, travellers stepper
  const [tripType, setTripType] = useState<'round' | 'oneway'>('round');
  const fromBoxRef = useRef<HTMLLabelElement>(null);
  const toBoxRef = useRef<HTMLLabelElement>(null);
  const swapRef = useRef<HTMLButtonElement>(null);
  const paxRef = useRef<HTMLSpanElement>(null);
  const returnInputRef = useRef<HTMLInputElement>(null);
  const motionOk = () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const swapRoute = () => {
    setFormData(prev => ({ ...prev, from: prev.to, to: prev.from }));
    if (!motionOk()) return;
    const turn = swapRef.current?.dataset.turn === '1' ? '0' : '1';
    if (swapRef.current) swapRef.current.dataset.turn = turn;
    swapRef.current?.animate(
      [{ transform: 'translate(-50%,-50%) rotate(0)' }, { transform: 'translate(-50%,-50%) rotate(180deg) scale(1.15)' }, { transform: 'translate(-50%,-50%) rotate(180deg)' }],
      { duration: 400, easing: 'ease-out' },
    );
    // Stacked on phones (swap vertically), side by side from sm up (swap horizontally)
    const side = window.matchMedia('(min-width: 640px)').matches;
    const d = 24;
    fromBoxRef.current?.animate([{ transform: side ? `translateX(${d}px)` : `translateY(${d}px)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 350, easing: 'ease-out' });
    toBoxRef.current?.animate([{ transform: side ? `translateX(-${d}px)` : `translateY(-${d}px)`, opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 350, easing: 'ease-out' });
  };

  const changePax = (delta: number) => {
    setFormData(prev => ({ ...prev, flightPassengers: Math.max(1, Math.min(9, prev.flightPassengers + delta)) }));
    if (motionOk()) paxRef.current?.animate(
      [{ transform: `translateY(${delta > 0 ? 10 : -10}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 220, easing: 'ease-out' },
    );
  };

  const chooseTripType = (type: 'round' | 'oneway') => {
    setTripType(type);
    if (type === 'oneway') setFormData(prev => ({ ...prev, return: '' }));
    else setTimeout(() => returnInputRef.current?.showPicker?.(), 50);
  };

  // Local YYYY-MM-DD for date minimums, and a short weekday label for picked dates
  const todayIso = (() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); })();
  const dayLabel = (iso: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';

  // Option tiles: per-icon animation, arrow-key navigation
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const iconRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  // restart = true replays even if the icon is mid-animation (clicks); hover lets it finish
  const playIcon = useCallback((id: string, restart = false) => {
    const el = iconRefs.current[id];
    const motion = ICON_MOTION[id];
    if (!el || !motion || typeof el.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getAnimations().length) {
      if (!restart) return;
      el.getAnimations().forEach(a => a.cancel());
    }
    el.animate(motion.frames, { duration: motion.duration, easing: motion.easing ?? 'ease' });
    if (motion.puff) {
      // Little particles (smoke, waves) drifting off the icon
      for (let i = 0; i < 3; i++) {
        const puff = document.createElement('span');
        puff.textContent = motion.puff;
        puff.setAttribute('aria-hidden', 'true');
        puff.className = 'pointer-events-none absolute left-1/2 top-1/2 text-lg';
        el.parentElement?.appendChild(puff);
        const dx = motion.puff === '💨' ? -30 - i * 10 : (i - 1) * 26;
        puff.animate([
          { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
          { opacity: 0.9, offset: 0.2 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${motion.puff === '🌊' ? -18 : 28}px)) scale(1.1)`, opacity: 0 },
        ], { duration: 900, delay: i * 180, easing: 'ease-out', fill: 'backwards' }).onfinish = () => puff.remove();
      }
    }
  }, []);

  // Sub-option tiles (Tourism categories, Study options): animated icon + label, one selectable
  const [studyChoice, setStudyChoice] = useState('Academy');
  const [studyForm, setStudyForm] = useState({ level: '', query: '', location: '' });
  const [studyError, setStudyError] = useState<string | null>(null);
  const pickStudy = (label: string) => {
    setStudyChoice(label);
    setResults([]);
    setHasSearched(false);
    setStudyError(null);
  };
  const optionTiles = (
    options: { id: string; icon: string; label: string }[],
    selectedLabel: string,
    onPick: (label: string) => void,
    ariaLabel: string,
    gridClass: string,
  ) => (
    <div role="radiogroup" aria-label={ariaLabel} className={`grid gap-2 sm:gap-3 mb-6 ${gridClass}`}>
      {options.map((o, i) => {
        const selected = selectedLabel === o.label;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => { onPick(o.label); playIcon(o.id, true); }}
            onMouseEnter={() => playIcon(o.id)}
            style={{ animationDelay: `${i * 35}ms` }}
            className={`group relative overflow-hidden flex flex-col items-center gap-2 rounded-xl px-2 py-3 sm:py-4 text-center transition-all duration-300 ease-out animate-[tileIn_400ms_ease-out_backwards] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${
              selected
                ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500 shadow-md'
                : 'bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-white hover:ring-brand-300 hover:text-brand-700 hover:shadow-md hover:-translate-y-1'
            }`}
          >
            <span className={`relative flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 ${selected ? 'bg-white' : 'bg-white group-hover:bg-brand-50'}`}>
              <span
                aria-hidden
                ref={el => { iconRefs.current[o.id] = el; }}
                className="inline-block text-3xl leading-none will-change-transform"
              >
                {o.icon}
              </span>
            </span>
            <span className="text-xs sm:text-sm font-semibold leading-tight">{o.label}</span>
          </button>
        );
      })}
    </div>
  );

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = tiles.indexOf(activeTile);
    const next = tiles[(i + (e.key === 'ArrowRight' ? 1 : tiles.length - 1)) % tiles.length];
    switchTab(next.items[0]);
    tabRefs.current[next.id]?.focus();
    playIcon(next.motion, true);
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
   
    setUberPickup(null);
    setUberPickerKey(k => k + 1);
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
        stayType,
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
    setPriceInsights(data.priceInsights ?? null);
    return (data.results ?? []) as SearchResult[];
  };


  type VisaInfo = { from: string; to: string; fromName: string; toName: string; status: string; days: number | null; label: string };
  const [tourForm, setTourForm] = useState({ from: '', to: '', purpose: 'tourist', destination: '', origin: '', sub: 'umrah' });
  const [tourVisa, setTourVisa] = useState<VisaInfo | null>(null);
  const [tourError, setTourError] = useState<string | null>(null);
  const tourChoice = TOUR_OPTIONS.find(o => o.label === formData.activityType) ?? TOUR_OPTIONS.find(o => o.id === 'tour-destination')!;
  const tourSlug = tourChoice.id.replace('tour-', '');
  const pickTour = (label: string) => {
    setFormData(prev => ({ ...prev, activityType: label }));
    setResults([]);
    setHasSearched(false);
    setTourVisa(null);
    setTourError(null);
  };
  const tourReady = tourSlug === 'visa' ? !!(tourForm.from && tourForm.to)
    : tourSlug === 'passport' || tourSlug === 'id' ? !!tourForm.from
    : tourSlug === 'religious' ? !!tourForm.origin.trim() && (tourForm.sub !== 'other' || !!tourForm.destination.trim())
    : !!tourForm.destination.trim();

  const searchTourismViaApi = async (): Promise<SearchResult[]> => {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service:     'tourism',
        category:    tourSlug,
        from:        tourForm.from || null,
        to:          tourForm.to || null,
        purpose:     tourForm.purpose,
        sub:         tourSlug === 'religious' ? tourForm.sub : null,
        origin:      tourForm.origin.trim() || null,
        destination: tourForm.destination.trim() || null,
      }),
    });
    const data = await res.json();
    setTourVisa(data.visa ?? null);
    setTourError(data.error ?? null);
    if (!res.ok) return [];
    return (data.results ?? []) as SearchResult[];
  };

  const [eventForm, setEventForm] = useState({ category: '', query: '', location: '', when: '' });
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventNotice, setEventNotice] = useState<string | null>(null);

  const searchEventsViaApi = async (): Promise<SearchResult[]> => {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service:  'events',
        location: eventForm.location.trim(),
        category: eventForm.category || null,
        query:    eventForm.query.trim() || null,
        when:     eventForm.when || null,
        today:    todayIso,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Event search failed');
    setEventError(data.error ?? null);
    setEventNotice(data.notice ?? null);
    return (data.results ?? []) as SearchResult[];
  };

  const searchStudyViaApi = async (): Promise<SearchResult[]> => {
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service:  'study',
        category: studyChoice.toLowerCase(),
        level:    studyForm.level || null,
        query:    studyForm.query.trim() || null,
        location: studyForm.location.trim() || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Study search failed');
    setStudyError(data.error ?? null);
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
      } else if (service === 'tourism') {
        const data = await searchTourismViaApi();
        setResults(data);
      } else if (service === 'events') {
        const data = await searchEventsViaApi();
        setResults(data);
      } else if (service === 'study') {
        const data = await searchStudyViaApi();
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
          ...extras,
          ref:             getReferral(),
          idToken:         await idTokenOrNull(),
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
            ...extras,
            ref:     getReferral(),
            idToken: await idTokenOrNull(),
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

    // Other flights (from Google Flights search) can't be ticketed on Lyrtrip; the modal links out instead
  };

  const tabs = [
    { id: 'flights', icon: '✈️', label: t('Flights'), sub: t('Fly anywhere') },
    { id: 'helicopter', icon: '🚁', label: t('Helicopter'), sub: t('Charter a helicopter') },
    { id: 'seaplane', icon: '🛩️', label: t('Seaplane'), sub: t('Island & water flights') },
    { id: 'airambulance', icon: '🚑', label: t('Air ambulance'), sub: t('Medical flights') },
    { id: 'bus', icon: '🚌', label: t('Bus'), sub: t('Intercity routes') },
    { id: 'train', icon: '🚂', label: t('Train'), sub: t('Rail journeys') },
    { id: 'cruise', icon: '🚢', label: t('Cruise'), sub: t('Sail away') },
    { id: 'car', icon: '🚗', label: t('Car'), sub: t('Book a ride') },
    { id: 'taxi', icon: '🚕', label: t('Taxi'), sub: t('Licensed taxis') },
    { id: 'limo', icon: '🥂', label: t('Limo'), sub: t('Luxury rides') },
    { id: 'ambulance', icon: '🚨', label: t('Ambulance'), sub: t('Patient transfers') },
    { id: 'motorcycle', icon: '🏍️', label: t('Motorcycle'), sub: t('Bike taxis') },
    { id: 'bike', icon: '🚲', label: t('Bike'), sub: t('Shared bikes') },
    { id: 'ebike', icon: '⚡', label: t('E-bike'), sub: t('Electric bikes') },
    { id: 'scooter', icon: '🛴', label: t('Moped & scooter'), sub: t('Scooters & mopeds') },
    { id: 'hotels', icon: '🏨', label: t('Hotels'), sub: t('Places to stay') },
    { id: 'food', icon: '🍱', label: t('Food delivery'), sub: t('From any restaurant') },
    { id: 'dash', icon: '🛵', label: t('Courier'), sub: t('Same-day parcels') },
    { id: 'shipping', icon: '📦', label: t('Shipment'), sub: t('Send parcels') },
    { id: 'truck', icon: '🚚', label: t('Truck booking'), sub: t('Loads, moving & haulage') },
    { id: 'freight', icon: '🚢', label: t('Cargo & containers'), sub: t('Sea, air & rail freight') },
    { id: 'tourism', icon: '🎒', label: t('Tourism'), sub: t('Tours & trips') },
    { id: 'study', icon: '🎓', label: t('Study'), sub: t('Study abroad') },
    { id: 'career', icon: '💼', label: t('Job'), sub: t('Find work') },
    { id: 'tax', icon: '🧾', label: t('Tax services'), sub: t('Returns, GST/VAT & advice') },
    { id: 'legal', icon: '📜', label: t('Legal services'), sub: t('Documents & registrations') },
    { id: 'lawyer', icon: '👩‍⚖️', label: t('Lawyers'), sub: t('Advice & representation') },
    { id: 'events', icon: '🎟️', label: t('Events'), sub: t('Concerts & shows') },
    { id: 'charity', icon: '🤲', label: t('Charity'), sub: t('Donate & give') },
  ];
  const tabById = Object.fromEntries(tabs.map(tab => [tab.id, tab]));
  // Ride tabs share one booking flow (estimate, then book with Lyrtrip's 10% once ride booking opens); each shows its own tiers
  const RIDE_KINDS: Record<string, { title: string; none: string; tiers: string[] }> = {
    car: { title: t('Request a ride'), none: t('No cars on this route right now.'), tiers: ['Standard', 'Comfort', 'XL', 'Premium', 'Premium SUV'] },
    taxi: { title: t('Book a taxi'), none: t('No taxis on this route right now. Try a car instead.'), tiers: ['Taxi'] },
    limo: { title: t('Book a limo or luxury car'), none: t('No luxury cars on this route right now.'), tiers: ['Limo', 'Premium', 'Premium SUV'] },
    motorcycle: { title: t('Book a motorcycle taxi'), none: t('No motorcycle taxis in this city right now. Try a car instead.'), tiers: ['Motorcycle'] },
  };
  const kindPrices = RIDE_KINDS[activeTab] ? uberPrices.filter(r => RIDE_KINDS[activeTab].tiers.includes(r.name)) : [];
  // Bikes, e-bikes and scooters: not bookable yet
  const MICRO_RIDES: Record<string, [string, string]> = {
    bike: ['🚲', t('Bike rides')], ebike: ['⚡', t('E-bike rides')], scooter: ['🛴', t('Moped & scooter rides')],
  };

  // The tiles: Transport, Stay, Shipping, Tax & Legal and Events group several tabs (shown as a row of options below)
  const TAB_GROUPS = [
    { id: 'transport', icon: '✈️', motion: 'flights', label: t('Transport'), sub: t('Flights, air charters, bus, train, cruise & rides'), items: ['flights', 'helicopter', 'seaplane', 'airambulance', 'bus', 'train', 'cruise', 'car', 'taxi', 'limo', 'ambulance', 'motorcycle', 'bike', 'ebike', 'scooter'] },
    { id: 'stay', icon: '🏨', motion: 'hotels', label: t('Stay'), sub: t('Hotels, homestays & more'), items: ['hotels'] },
    { id: 'shippinggroup', icon: '📦', motion: 'shipping', label: t('Shipping'), sub: t('Food, courier, parcels, trucks & cargo'), items: ['food', 'dash', 'shipping', 'truck', 'freight'] },
    { id: 'taxlegal', icon: '⚖️', motion: 'taxlegal', label: t('Tax & Legal'), sub: t('Tax, legal & lawyers'), items: ['tax', 'legal', 'lawyer'] },
    { id: 'eventsgroup', icon: '🎟️', motion: 'events', label: t('Events'), sub: t('Shows, summits & charity'), items: ['events', 'charity'] },
  ];
  const tiles = [
    // In tab order: a group sits where its first tab would be
    ...tabs.flatMap(tab => {
      const group = TAB_GROUPS.find(g => g.items.includes(tab.id));
      if (!group) return [{ ...tab, motion: tab.id, items: [tab.id] }];
      return group.items[0] === tab.id ? [group] : [];
    }),
  ];
  const activeTile = tiles.find(g => g.items.includes(activeTab)) ?? tiles[0];
  // Options with their own options: Helicopter opens Seaplane and Air ambulance (they stay out of the group's own row)
  const SUB_MENUS: Record<string, string[]> = { helicopter: ['helicopter', 'seaplane', 'airambulance'] };
  const subParent = (id: string) => Object.keys(SUB_MENUS).find(k => SUB_MENUS[k].includes(id)) ?? id;
  const groupMenu = activeTile.items.filter(id => subParent(id) === id);
  const subMenu = SUB_MENUS[subParent(activeTab)] ?? null;
  const tileGrid = (n: number) => (n <= 3 ? 'grid-cols-3 max-w-2xl' : n <= 5 ? 'grid-cols-3 sm:grid-cols-5' : n <= 8 ? 'grid-cols-4 sm:grid-cols-8' : 'grid-cols-3 sm:grid-cols-5 md:grid-cols-7');
  const menuTiles = (ids: string[], selected: string, aria: string) => optionTiles(
    ids.map(id => ({ id: `sub-${id}`, icon: tabById[id].icon, label: tabById[id].label })),
    tabById[selected]?.label ?? '', label => { const id = ids.find(x => tabById[x].label === label); if (id && id !== activeTab) switchTab(id); }, aria, tileGrid(ids.length),
  );
  const STAY_TYPES: [string, string, string][] = [
    ['hotels', '🏨', t('Hotels')], ['homestays', '🏡', t('Homestays')], ['resorts', '🏝️', t('Resorts')], ['hostels', '🛏️', t('Hostels & dorms')],
    ['apartments', '🏢', t('Apartments')], ['villas', '🏘️', t('Villas')], ['guesthouses', '🛖', t('Guesthouses')], ['bnb', '☕', t('B&Bs')],
  ];
  const subPill = (active: boolean) => `inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
    active ? 'bg-btn text-white shadow-sm' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand-300 hover:text-brand-700'}`;

  const inputClass = "w-full px-4 py-3 text-base text-gray-900 bg-gray-50 border border-gray-200 rounded-xl shadow-sm transition-all duration-200 placeholder:text-gray-400 hover:border-brand-300 hover:bg-white focus:outline-none focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-100";
  // Field box: icon + small label + borderless input, highlighted while any child has focus
  const fieldBox = "group/field relative flex min-h-[3.75rem] items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 transition-all duration-200 hover:border-brand-300 hover:bg-white focus-within:border-brand-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-brand-100 focus-within:shadow-md";
  const fieldIcon = "h-5 w-5 shrink-0 text-gray-400 transition-colors duration-200 group-focus-within/field:text-brand-500 group-hover/field:text-brand-400";
  const fieldLabel = "block truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-gray-500";
  const fieldInput = "w-full min-w-0 truncate bg-transparent p-0 text-base font-semibold text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-400";
  const stepBtn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold leading-none text-brand-600 ring-1 ring-gray-200 transition-all hover:bg-brand-50 hover:ring-brand-300 active:scale-90 disabled:cursor-not-allowed disabled:text-gray-300 disabled:ring-gray-100 disabled:hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300";
  const searchBtn = (service: string, disabled = false, tall = false) => (
    <div className={tall ? 'flex' : 'flex items-end'}>
      <button
        onClick={e => { addRipple(e); handleSearch(service); }}
        disabled={loading || disabled}
        className={`relative w-full overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 ${tall ? 'min-h-[3.75rem] rounded-2xl' : ''} text-base bg-btn text-white font-bold rounded-xl shadow-md shadow-btn/25 transition-all duration-200 hover:bg-btn-hover hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:bg-gray-400 disabled:shadow-none disabled:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200`}
      >
        {loading ? (
          <span aria-hidden className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="h-5 w-5 shrink-0">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
        )}
        {loading ? 'Searching…' : 'Search'}
      </button>
    </div>
  );

  // Shown instead of placeholder results when no provider returned live data
  const NoLiveResults = ({ service, icon, title, hint, retry = true }: { service: string; icon: string; title: string; hint: string; retry?: boolean }) => (
    <div role="status" className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center animate-[panelIn_250ms_ease-out]">
      <span aria-hidden className="mb-3 text-4xl">{icon}</span>
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-gray-600">{hint}</p>
      {retry && <button
        type="button"
        onClick={() => handleSearch(service)}
        className="mt-5 rounded-xl bg-btn px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-btn-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
      >
        Search again
      </button>}
    </div>
  );

  const HotelList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">{t('Searching hotels...')}</p>;
    if (results.length === 0 || results.every(r => r.demo)) {
      const place = formData.destination.trim() || formData.destinationLocation?.address || '';
      return (
        <NoLiveResults
          service="hotels"
          icon="🏨"
          title={place ? `No hotels available in ${place} right now` : 'Choose a destination to see hotels'}
          hint={place
            ? 'We couldn\'t get live prices for this search. Try a nearby city, different dates, or search again in a moment.'
            : 'Start typing a city, area or landmark, pick one of the suggestions, then search.'}
          retry={!!place}
        />
      );
    }
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
                      <p className="text-xl font-bold text-brand-700"><Price amount={result.pricePerNight} currency={result.currency ?? 'USD'} /></p>
                      <p className="text-xs text-gray-500">{t('per night')}</p>
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
                  className="ml-auto px-4 py-1.5 bg-btn text-white text-sm font-semibold rounded-lg hover:bg-btn-hover transition"
                >
                  {t('Book')}
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
    if (loading) return <p className="text-gray-500 mt-6">{t('Searching flights...')}</p>;
    if (results.length === 0 && flightSearchError) return <p className="text-gray-600 mt-6">{flightSearchError}. Pick a city or airport from the suggestions.</p>;
    if (results.length === 0 || results.every(r => r.demo)) return (
      <NoLiveResults
        service="flights"
        icon="✈️"
        title={formData.from && formData.to ? `No flights available from ${formData.from} to ${formData.to} right now` : 'No flights found'}
        hint="We couldn't get live fares for this route and date. Try nearby airports, different dates, or search again in a moment."
      />
    );
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
            {r.price != null && <p className="text-xl font-bold text-brand-700"><Price amount={r.price} currency={r.currency ?? 'USD'} /></p>}
            <p className="text-xs text-gray-500">{t('per person')}</p>
            {priceInsights?.typicalLow != null && r.price != null && (r.currency ?? 'USD') === 'USD' && r.price < priceInsights.typicalLow && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">{t('Below typical price')}</span>
            )}
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
                {t('View deal')} ↗
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
              className="mt-1 px-4 py-1.5 bg-btn text-white text-sm font-semibold rounded-lg hover:bg-btn-hover transition"
            >
              {t('Select')}
            </button>
            )}
          </div>
        </div>
      );
    };
    return (
      <div className="mt-6 space-y-2">
        {priceInsights && (
          <div className="mb-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">{t('Compared with other sites')}: </span>
            {priceInsights.typicalLow != null && priceInsights.typicalHigh != null
              ? t('{source} shows typical fares of {low} to {high} for this route, and the lowest today is {lowest}.', {
                source: priceInsights.source,
                low: money(priceInsights.typicalLow),
                high: money(priceInsights.typicalHigh),
                lowest: money(priceInsights.lowestPrice),
              })
              : t('{source} shows the lowest fare today at {lowest}.', { source: priceInsights.source, lowest: money(priceInsights.lowestPrice) })}
            {priceInsights.priceLevel === 'low' && <span className="ms-1 font-semibold text-green-700">{t('Prices are low right now.')}</span>}
            {priceInsights.priceLevel === 'high' && <span className="ms-1 font-semibold text-orange-600">{t('Prices are higher than usual.')}</span>}
          </div>
        )}
        {best.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{t('Best flights')}</p>
            {best.map(r => <FlightRow key={r.id} r={r} />)}
          </>
        )}
        {other.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-5 mb-2">{t('Other flights')}</p>
            {other.map(r => <FlightRow key={r.id} r={r} />)}
          </>
        )}
      </div>
    );
  };

  const EventList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching events...</p>;
    if (results.length === 0) return (
      <NoLiveResults
        service="events"
        icon="🎟️"
        title={eventError ?? `No events found${eventForm.location.trim() ? ` in ${eventForm.location.trim()}` : ''}`}
        hint="Try a bigger city nearby, a wider date range, or a different event type."
      />
    );
    return (
      <>
      {eventNotice && (
        <p role="status" className="mt-6 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 ring-1 ring-amber-200">{eventNotice}</p>
      )}
      <div className={`${eventNotice ? 'mt-4' : 'mt-6'} grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
        {results.map(r => (
          <div key={r.id} className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all animate-[panelIn_250ms_ease-out]">
            {/* Placeholder sits under the photo, so a missing, slow or broken image still shows something */}
            <div className="relative h-40 bg-brand-50 flex items-center justify-center text-5xl" aria-hidden>
              🎟️
              {r.imageUrl && (
                <img src={r.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              {r.startDate && (
                <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-700 shadow">{r.startDate}</span>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-bold text-gray-900 leading-snug line-clamp-2">{r.name}</h3>
              {r.when && <p className="mt-1 text-sm font-medium text-brand-600">{r.when}</p>}
              {(r.venue || r.address) && (
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                  {r.venue && <span className="font-semibold text-gray-700">{r.venue}</span>}
                  {r.venue && r.address && ' · '}
                  {r.address && r.address !== r.venue ? r.address.replace(`${r.venue}, `, '') : ''}
                </p>
              )}
              {r.description && <p className="mt-2 text-xs text-gray-500 line-clamp-2">{r.description}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-3">
                {r.applyToken && (
                  <button type="button" onClick={() => setApplyEvent({ name: r.name, when: r.when, venue: r.venue, address: r.address, applyToken: r.applyToken! })}
                    className="px-3 py-1.5 bg-btn text-white text-sm font-semibold rounded-lg hover:bg-btn-hover transition">
                    Get tickets
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
    );
  };

  // Tourism result card: sold through Lyrtrip, so no website, map, phone or source link is shown
  const tourBookLabel: Record<string, string> = {
    visa: 'Get visa help via Lyrtrip →', passport: 'Get passport help via Lyrtrip →', id: 'Get ID help via Lyrtrip →',
    insurance: 'Get insured via Lyrtrip →', destination: 'Plan a trip here via Lyrtrip →',
  };
  const tourCard = (r: SearchResult) => (
        <div key={r.id} className="flex bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition animate-[panelIn_250ms_ease-out]">
          {r.kind === 'place' && (
            /* Placeholder sits under the photo, so a missing, slow or broken image still shows something */
            <div className="relative w-24 sm:w-36 shrink-0 bg-brand-50 flex items-center justify-center text-4xl" aria-hidden>
              {tourChoice.icon}
              {r.imageUrl && (
                <img src={r.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {r.official && <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-700 ring-1 ring-green-200">Official information</span>}
              {r.placeType && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{r.placeType}</span>}
              {r.rating != null && <span className="text-yellow-600 font-semibold">★ {r.rating}</span>}
              {r.reviewCount != null && <span>({r.reviewCount.toLocaleString()} reviews)</span>}
              {r.postedAt && <span>{r.postedAt}</span>}
            </div>
            <h3 className="mt-1 font-bold text-gray-900 leading-snug">{r.name}</h3>
            {r.address && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{r.address}</p>}
            {r.description && <p className="mt-1 text-sm text-gray-600 line-clamp-3">{r.description}</p>}
            {r.applyToken && (
              <button type="button" onClick={() => setBookTour({ name: r.name, placeType: r.placeType, address: r.address, applyToken: r.applyToken! })}
                className="mt-3 px-4 py-1.5 bg-btn text-white text-sm font-semibold rounded-lg hover:bg-btn-hover transition">
                {tourBookLabel[tourSlug] ?? 'Book via Lyrtrip →'}
              </button>
            )}
          </div>
        </div>
  );

  const VISA_STYLE: Record<string, string> = {
    'visa-free':    'bg-green-50 text-green-800 ring-green-200',
    'domestic':     'bg-green-50 text-green-800 ring-green-200',
    'on-arrival':   'bg-sky-50 text-sky-800 ring-sky-200',
    'eta':          'bg-sky-50 text-sky-800 ring-sky-200',
    'e-visa':       'bg-amber-50 text-amber-800 ring-amber-200',
    'required':     'bg-orange-50 text-orange-800 ring-orange-200',
    'no-admission': 'bg-red-50 text-red-800 ring-red-200',
  };
  const VISA_ICON: Record<string, string> = { 'visa-free': '✅', domestic: '🏠', 'on-arrival': '🛬', eta: '📱', 'e-visa': '💻', required: '📝', 'no-admission': '⛔' };

  const TourismList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching {tourChoice.label.toLowerCase()}...</p>;
    return (
      <div className="mt-6 space-y-3">
        {tourVisa && (
          <div className={`rounded-2xl p-5 ring-1 animate-[panelIn_250ms_ease-out] ${VISA_STYLE[tourVisa.status] ?? 'bg-gray-50 text-gray-800 ring-gray-200'}`}>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">{tourVisa.fromName} passport → {tourVisa.toName}</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-bold">
              <span aria-hidden>{VISA_ICON[tourVisa.status] ?? 'ℹ️'}</span>{tourVisa.label}
            </p>
            {tourVisa.status !== 'domestic' && (
              <p className="mt-2 text-sm opacity-80">
                Visa types, documents and fees for a {tourForm.purpose} trip are below, official sources first.
                Lyrtrip can prepare and file the application for you: pick one below to get the documents checked and a quote.
              </p>
            )}
          </div>
        )}
        {results.length === 0 ? (
          (!tourVisa || tourVisa.status !== 'domestic') && (
            <NoLiveResults
              service="tourism"
              icon={tourChoice.icon}
              title={tourError ?? 'No results found'}
              hint="Try a nearby or bigger place, or check the spelling."
            />
          )
        ) : (
          results.map(tourCard)
        )}
      </div>
    );
  };

  const StudyList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching {studyChoice === 'Academy' ? 'schools and universities' : studyChoice === 'Admission' ? 'admission info' : 'scholarships'}...</p>;
    if (results.length === 0) return (
      <NoLiveResults
        service="study"
        icon={studyChoice === 'Academy' ? '🏫' : studyChoice === 'Admission' ? '📬' : '🏅'}
        title={studyError ?? 'No results found'}
        hint="Try a broader keyword, a different level, or a bigger place like a country instead of a town."
      />
    );
    return (
      <div className="mt-6 space-y-3">
        {results.map(studyCard)}
      </div>
    );
  };

  // Study results never show the institution's website, phone or page: students apply through Lyrtrip
  const studyCard = (r: SearchResult) => (
    <div key={r.id} className="flex bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition animate-[panelIn_250ms_ease-out]">
      {r.kind === 'place' && (
        <div className="relative w-24 sm:w-36 shrink-0 bg-brand-50 flex items-center justify-center text-4xl" aria-hidden>
          🏫
          {r.imageUrl && (
            <img src={r.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0 p-4">
        <h3 className="font-bold text-gray-900 leading-tight">{r.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          {r.placeType && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{r.placeType}</span>}
          {r.rating != null && <span className="text-yellow-600 font-semibold">★ {r.rating}</span>}
          {r.reviewCount != null && <span>({r.reviewCount.toLocaleString()} reviews)</span>}
          {r.postedAt && <span>{r.postedAt}</span>}
        </div>
        {r.address && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{r.address}</p>}
        {r.description && <p className="mt-1 text-sm text-gray-600 line-clamp-3">{r.description}</p>}
        <div className="mt-3">
          {r.applyToken ? (
            <button type="button"
              onClick={() => setApplyStudy({ name: r.name, placeType: r.placeType, address: r.address, applyToken: r.applyToken!, type: studyChoice === 'Scholarship' ? 'scholarship' : 'admission' })}
              className="px-4 py-1.5 bg-btn text-white text-sm font-semibold rounded-lg hover:bg-btn-hover transition">
              {studyChoice === 'Scholarship' ? 'Apply for scholarship via Lyrtrip →' : 'Apply via Lyrtrip →'}
            </button>
          ) : <span className="text-xs text-gray-400">Example listing</span>}
        </div>
      </div>
    </div>
  );

  const JobList = () => {
    if (!hasSearched) return null;
    if (loading) return <p className="text-gray-500 mt-6">Searching jobs worldwide...</p>;
    if (results.length === 0) return <p className="text-gray-600 mt-6">No jobs found. Try different keywords or location.</p>;
    return (
      <div className="mt-6 space-y-4">
        {results.map(result => (
          <div key={result.id} className="flex bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition">
            <div className="w-20 bg-gray-50 flex items-center justify-center p-3 shrink-0 border-r border-gray-100">
              <div className="w-14 h-14 bg-brand-100 flex items-center justify-center text-3xl rounded-lg">💼</div>
            </div>
            <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 text-base leading-tight">{result.name}</h3>
                    {result.jobLocation && <p className="text-xs text-gray-500 mt-0.5">📍 {result.jobLocation}</p>}
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
                  <p className={`text-sm text-gray-600 mt-2 whitespace-pre-line ${openJobs[result.id] ? '' : 'line-clamp-3'}`}>{result.description}</p>
                )}
                {result.highlights && result.highlights.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {(openJobs[result.id] ? result.highlights : result.highlights.slice(0, 1)).map(h => (
                      <div key={h.title}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{h.title}</p>
                        {openJobs[result.id] ? (
                          <ul className="list-disc pl-5 mt-1 space-y-0.5">
                            {h.items.map((item, i) => <li key={i} className="text-sm text-gray-700">{item}</li>)}
                          </ul>
                        ) : (
                          <ul className="flex flex-wrap gap-1 mt-1">
                            {h.items.slice(0, 3).map((item, i) => (
                              <li key={i} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {((result.description?.length ?? 0) > 200 || (result.highlights?.length ?? 0) > 0) && (
                  <button type="button" onClick={() => setOpenJobs(o => ({ ...o, [result.id]: !o[result.id] }))}
                    className="mt-2 text-sm font-medium text-brand-700 hover:underline">
                    {openJobs[result.id] ? 'Show less' : 'Show full job details'}
                  </button>
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
                </div>
                {result.applyToken ? (
                  <button
                    type="button"
                    onClick={() => setApplyJob({ name: result.name, jobLocation: result.jobLocation, applyToken: result.applyToken! })}
                    className="px-4 py-1.5 bg-btn text-white text-sm font-semibold rounded-lg hover:bg-btn-hover transition"
                  >
                    Apply via Lyrtrip →
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">Example listing</span>
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
                <Price amount={result.price} currency={result.currency ?? 'USD'} />{result.unit ?? ''}
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
                  <p className="text-xl font-bold text-brand-700"><Price amount={j.price} currency={j.currency} /></p>
                  <p className="text-xs text-gray-500">{t('per person')}</p>
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
      <main className="mx-auto max-w-screen-2xl min-h-[110vh] px-4 pt-24 pb-32 sm:px-6 sm:pt-28 sm:pb-40 lg:px-10 lg:pt-32 lg:pb-48">

        {/* Hero: equal space above and below centers the button between header and search card */}
        <div className="text-center mb-24 sm:mb-28 lg:mb-32">
          <button
            type="button"
            onClick={handleLocationClick}
            aria-expanded={showLocationMap}
            aria-controls="location-map"
            aria-busy={locationLoading}
            title={locationError ? 'Try locating you again' : showLocationMap ? 'Hide map' : 'Show my location on the map'}
            className="group relative inline-flex items-center gap-3 rounded-full bg-btn py-3 pl-3 pr-6 text-base sm:text-lg font-bold text-white shadow-lg shadow-btn/30 transition-all duration-200 hover:bg-btn-hover hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
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
          {/* Option tiles */}
          <div
            role="tablist"
            aria-label="Services"
            onKeyDown={onTabKeyDown}
            className="grid grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 border-b border-gray-100 p-3 sm:p-5"
          >
            {tiles.map((tab, i) => {
              const isActive = activeTile.id === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={el => { tabRefs.current[tab.id] = el; }}
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => { if (!isActive) switchTab(tab.items[0]); playIcon(tab.motion, true); }}
                  onMouseEnter={() => playIcon(tab.motion)}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={`group relative overflow-hidden flex flex-col items-center justify-center gap-2 rounded-2xl px-2 py-4 sm:py-5 text-center transition-all duration-300 ease-out animate-[tileIn_400ms_ease-out_backwards] focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ${
                    isActive
                      ? 'bg-btn text-white shadow-lg shadow-btn/30 -translate-y-0.5'
                      : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-brand-300 hover:text-brand-700 hover:shadow-md hover:-translate-y-1'
                  }`}
                >
                  <span
                    className={`relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl transition-colors duration-300 ${
                      isActive ? 'bg-white/15' : 'bg-brand-50 group-hover:bg-brand-100'
                    }`}
                  >
                    <span
                      aria-hidden
                      ref={el => { iconRefs.current[tab.motion] = el; }}
                      className="inline-block text-4xl sm:text-[2.6rem] leading-none will-change-transform"
                    >
                      {tab.icon}
                    </span>
                  </span>
                  <span className="text-sm sm:text-base font-bold leading-tight">{tab.label}</span>
                  <span className={`hidden sm:block text-xs leading-tight ${isActive ? 'text-white/80' : 'text-gray-500'}`}>{tab.sub}</span>
                </button>
              );
            })}
          </div>

          {/* Options inside a group, as large tiles like Tourism and Study: Transport, Shipping and Events pick a tab
              (Helicopter opens a second row), Stay picks the property type */}
          {(activeTile.items.length > 1 || activeTile.id === 'stay') && (
            <div className="border-b border-gray-100 px-3 sm:px-5 pt-4 sm:pt-5 bg-gray-50/60">
              {activeTile.id === 'stay'
                ? optionTiles(
                  STAY_TYPES.map(([id, icon, label]) => ({ id: `stay-${id}`, icon, label })),
                  STAY_TYPES.find(([id]) => id === stayType)?.[2] ?? '',
                  label => { const hit = STAY_TYPES.find(([, , l]) => l === label); if (hit) { setStayType(hit[0]); setResults([]); setHasSearched(false); } },
                  t('Property type'), tileGrid(STAY_TYPES.length),
                )
                : menuTiles(groupMenu, subParent(activeTab), activeTile.label)}
              {subMenu && (
                <div key={subParent(activeTab)} className="animate-[panelIn_250ms_ease-out]">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{tabById[subParent(activeTab)].label}</p>
                  {menuTiles(subMenu, activeTab, tabById[subParent(activeTab)].label)}
                </div>
              )}
            </div>
          )}

          {/* Forms */}
          <div key={activeTab} role="tabpanel" className="p-5 sm:p-8 animate-[panelIn_250ms_ease-out]">

            {/* Bike: no booking partner yet */}
            {MICRO_RIDES[activeTab] && (
              <div className="text-center py-10">
                <p className="text-5xl mb-3" aria-hidden>{MICRO_RIDES[activeTab][0]}</p>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{MICRO_RIDES[activeTab][1]}</h3>
                <p className="text-gray-600 max-w-md mx-auto mb-5">{t('Booking bikes, e-bikes, mopeds and scooters on Lyrtrip opens soon. Need to get there now? Book a car or a motorcycle taxi.')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button onClick={() => switchTab('car')} className="px-5 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover transition">{t('Book a car')}</button>
                  <button onClick={() => switchTab('motorcycle')} className="px-5 py-2.5 bg-white text-gray-800 ring-1 ring-gray-200 rounded-xl font-semibold hover:ring-brand-300 transition">{t('Book a motorcycle taxi')}</button>
                </div>
              </div>
            )}

            {/* Hotels */}
            {activeTab === 'hotels' && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Destination</label>
                    <LocationPicker
                      onLocationSelect={(loc) => handleLocationSelect('destinationLocation', loc)}
                      placeholder={t('Where are you going?')}
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
                {/* Trip type */}
                <div role="radiogroup" aria-label="Trip type" className="relative mb-4 inline-grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-semibold">
                  <span
                    aria-hidden
                    className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow transition-transform duration-300 ease-out ${tripType === 'oneway' ? 'translate-x-full' : ''}`}
                  />
                  {(['round', 'oneway'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={tripType === t}
                      onClick={() => chooseTripType(t)}
                      className={`relative rounded-full px-4 sm:px-5 py-1.5 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${tripType === t ? 'text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {t === 'round' ? 'Round trip' : 'One way'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {/* From / To with swap */}
                  <div className="relative col-span-2 md:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label ref={fromBoxRef} htmlFor="flight-from" className={`${fieldBox} pr-14 sm:pr-8`}>
                      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={fieldIcon}>
                        <path d="M2 22h20" /><path d="M6.4 17.4 3 14l1.5-1 3.5 1.5L17 9.6c1-.6 2.4-.4 3 .5.5.8.2 1.9-.6 2.4L8.5 18.6a2 2 0 0 1-2.1-1.2z" /><path d="m11 8.5-3-4.5 1.5-.8 5.5 4" />
                      </svg>
                      <span className="min-w-0 flex-1">
                        <span className={fieldLabel}>From</span>
                        <AirportInput id="flight-from" name="from" value={formData.from} onChange={v => setFormData(prev => ({ ...prev, from: v }))} placeholder="City, airport or code" className={fieldInput} listClassName="mt-3 -ml-12" />
                      </span>
                    </label>
                    <label ref={toBoxRef} htmlFor="flight-to" className={`${fieldBox} pr-14 sm:pr-4 sm:pl-8`}>
                      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={fieldIcon}>
                        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
                      </svg>
                      <span className="min-w-0 flex-1">
                        <span className={fieldLabel}>To</span>
                        <AirportInput id="flight-to" name="to" value={formData.to} onChange={v => setFormData(prev => ({ ...prev, to: v }))} placeholder="City, airport or code" className={fieldInput} listClassName="mt-3 -ml-12" />
                      </span>
                    </label>
                    <button
                      ref={swapRef}
                      type="button"
                      onClick={swapRoute}
                      aria-label="Swap origin and destination"
                      title="Swap"
                      style={{ transform: 'translate(-50%,-50%)' }}
                      className="absolute z-10 top-1/2 left-[calc(100%-2.25rem)] sm:left-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-md ring-1 ring-gray-200 transition-colors hover:bg-brand-50 hover:ring-brand-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
                    >
                      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 rotate-90 sm:rotate-0">
                        <path d="M7 4 3 8l4 4" /><path d="M3 8h14" /><path d="m17 20 4-4-4-4" /><path d="M21 16H7" />
                      </svg>
                    </button>
                  </div>

                  {/* Dates */}
                  <label htmlFor="flight-depart" className={`${fieldBox} col-span-2 min-[400px]:col-span-1 md:col-span-1`}>
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${fieldIcon} hidden lg:block`}>
                      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className={fieldLabel}>Depart {formData.depart && <span className="normal-case tracking-normal text-brand-500">· {dayLabel(formData.depart)}</span>}</span>
                      <input
                        id="flight-depart" type="date" name="depart" min={todayIso} value={formData.depart}
                        onChange={e => { const v = e.target.value; setFormData(prev => ({ ...prev, depart: v, return: prev.return && prev.return < v ? '' : prev.return })); }}
                        className={`${fieldInput.replace('text-base', 'text-sm sm:text-base')} [color-scheme:light]`}
                      />
                    </span>
                  </label>
                  {tripType === 'round' ? (
                    <label htmlFor="flight-return" className={`${fieldBox} col-span-2 min-[400px]:col-span-1 md:col-span-1`}>
                      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${fieldIcon} hidden lg:block`}>
                        <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="m9 15 2 2 4-4" />
                      </svg>
                      <span className="min-w-0 flex-1">
                        <span className={fieldLabel}>Return {formData.return ? <span className="normal-case tracking-normal text-brand-500">· {dayLabel(formData.return)}</span> : <span className="normal-case tracking-normal font-normal text-gray-400">(opt.)</span>}</span>
                        <input
                          ref={returnInputRef} id="flight-return" type="date" name="return" min={formData.depart || todayIso} value={formData.return}
                          onChange={handleInputChange}
                          className={`${fieldInput.replace('text-base', 'text-sm sm:text-base')} [color-scheme:light]`}
                        />
                      </span>
                    </label>
                  ) : (
                    <button
                      type="button"
                      onClick={() => chooseTripType('round')}
                      className="col-span-2 min-[400px]:col-span-1 md:col-span-1 flex min-h-[3.75rem] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 px-3 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                    >
                      <span aria-hidden className="text-lg leading-none">+</span> Add return
                    </button>
                  )}

                  {/* Travellers */}
                  <div className={`${fieldBox} cursor-default`}>
                    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`${fieldIcon} hidden lg:block`}>
                      <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3.5 2.8 3.5 6" />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span id="flight-pax-label" className={fieldLabel}>Adults</span>
                      <span role="group" aria-labelledby="flight-pax-label" className="flex items-center justify-between gap-2">
                        <button type="button" onClick={() => changePax(-1)} disabled={formData.flightPassengers <= 1} aria-label="Fewer adults" className={stepBtn}>−</button>
                        <span ref={paxRef} aria-live="polite" className="inline-block min-w-[1.5rem] text-center text-base font-bold text-gray-900">{formData.flightPassengers}</span>
                        <button type="button" onClick={() => changePax(1)} disabled={formData.flightPassengers >= 9} aria-label="More adults" className={stepBtn}>+</button>
                      </span>
                    </span>
                  </div>

                  {searchBtn('flights', false, true)}
                </div>
                <FlightList />
              </div>
            )}

            {/* Car */}
            {RIDE_KINDS[activeTab] && (
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
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-3">{RIDE_KINDS[activeTab].title}</h3>

                  <button className="mb-4 px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-200 transition">
                    🕐 Pickup now ▾
                  </button>

                  {/* Location inputs */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl bg-gray-50">
                      <span className="w-3 h-3 rounded-full bg-black shrink-0" />
                      <div className="flex-1">
                        <LocationPicker key={`pickup-${uberPickerKey}`}
                          onLocationSelect={(loc) => { setUberPickup(loc); setUberPrices([]); setUberPriceError(null); }}
                          placeholder={!locationLoading && !locationError ? '📍 Pickup: your current location' : 'Enter pickup location'}
                        />
                      </div>
                      {uberPickup && (
                        <button onClick={() => { setUberPickup(null); setUberPickerKey(k => k + 1); setUberPrices([]); }}
                          className="text-xs text-gray-600 underline shrink-0">Use my location</button>
                      )}
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
                  {uberPrices.length > 0 && !kindPrices.length && (
                    <p className="text-sm text-gray-600 mb-3">{RIDE_KINDS[activeTab].none}</p>
                  )}
                  {kindPrices.length > 0 && (
                    <div className="space-y-3">
                      {kindPrices.map(ride => {
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
                              {ride.price != null ? (<>
                                <p className="font-bold text-gray-900">{money(ride.price, ride.currencyCode || 'USD')}</p>
                                <p className="text-xs text-gray-400">{ride.pickupMinutes != null ? `${ride.pickupMinutes} min away · ` : ''}incl. fee</p>
                              </>) : (<>
                                <p className="font-bold text-gray-900">{money(ride.lowEstimate, ride.currencyCode || 'USD')}–{money(ride.highEstimate, ride.currencyCode || 'USD')}</p>
                                <p className="text-xs text-gray-400">+${serviceFee} fee</p>
                              </>)}
                              <button
                                onClick={() => {
                                  setRideDraft({ ride, pickupLat: ridePickup.lat, pickupLng: ridePickup.lng, dropoffLat: uberDropoff!.lat, dropoffLng: uberDropoff!.lng, pickupLabel: uberPickup?.address || 'Current location', dropoffLabel: uberDropoff!.address });
                                  
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
            {(activeTab === 'dash' || activeTab === 'food') && (
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>📍</span>
                    <span>{uberCity || 'Detecting location…'}</span>
                  </div>
                </div>

                <CourierDelivery key={activeTab} user={user} food={activeTab === 'food'} />

              </div>
            )}

            {/* Tourism */}
            {activeTab === 'tourism' && (
              <div>
                {optionTiles(TOUR_OPTIONS, tourChoice.label, pickTour, 'Tour category', 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7')}
                <div key={tourSlug} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 animate-[panelIn_250ms_ease-out]">
                  {tourSlug === 'visa' ? (
                    <>
                    <div>
                      <label htmlFor="tour-from" className="block text-sm font-semibold text-gray-700 mb-2">Passport from</label>
                      <select id="tour-from" value={tourForm.from} onChange={e => setTourForm(f => ({ ...f, from: e.target.value }))} className={inputClass}>
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="tour-to" className="block text-sm font-semibold text-gray-700 mb-2">Travelling to</label>
                      <select id="tour-to" value={tourForm.to} onChange={e => setTourForm(f => ({ ...f, to: e.target.value }))} className={inputClass}>
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                      <div>
                        <label htmlFor="tour-purpose" className="block text-sm font-semibold text-gray-700 mb-2">Visa type</label>
                        <select id="tour-purpose" value={tourForm.purpose} onChange={e => setTourForm(f => ({ ...f, purpose: e.target.value }))} className={inputClass}>
                          <option value="tourist">Tourist</option>
                          <option value="business">Business</option>
                          <option value="student">Student</option>
                          <option value="work">Work</option>
                          <option value="transit">Transit</option>
                          <option value="family visit">Family visit</option>
                        </select>
                      </div>
                    </>
                  ) : tourSlug === 'religious' ? (
                    <>
                      <div className="md:col-span-4">
                        <p className="block text-sm font-semibold text-gray-700 mb-2">Pilgrimage</p>
                        <div className="space-y-2">
                          {PILGRIMAGE_GROUPS.map(g => (
                            <div key={g.faith} className="flex flex-wrap items-center gap-2">
                              <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.faith}</span>
                              {g.items.map(([id, icon, name]) => (
                                <button key={id} type="button" onClick={() => { setTourForm(f => ({ ...f, sub: id })); setResults([]); setHasSearched(false); }}
                                  aria-pressed={tourForm.sub === id} className={subPill(tourForm.sub === id)}>
                                  <span aria-hidden>{icon}</span>{name}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className={tourForm.sub === 'other' ? 'md:col-span-1' : 'md:col-span-3'}>
                        <label htmlFor="tour-origin" className="block text-sm font-semibold text-gray-700 mb-2">Travelling from</label>
                        <input id="tour-origin" type="text" value={tourForm.origin} onChange={e => setTourForm(f => ({ ...f, origin: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && tourReady) handleSearch('tourism'); }} placeholder="City or country, e.g. Hyderabad" className={inputClass} />
                      </div>
                      {tourForm.sub === 'other' && (
                        <div className="md:col-span-2">
                          <label htmlFor="tour-destination" className="block text-sm font-semibold text-gray-700 mb-2">Shrine or place</label>
                          <input id="tour-destination" type="text" value={tourForm.destination} onChange={e => setTourForm(f => ({ ...f, destination: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && tourReady) handleSearch('tourism'); }} placeholder="e.g. Sabarimala, Ajmer Sharif, Shirdi" className={inputClass} />
                        </div>
                      )}
                    </>
                  ) : tourSlug === 'passport' || tourSlug === 'id' ? (
                    <div className="md:col-span-3">
                      <label htmlFor="tour-from" className="block text-sm font-semibold text-gray-700 mb-2">Your country</label>
                      <select id="tour-from" value={tourForm.from} onChange={e => setTourForm(f => ({ ...f, from: e.target.value }))} className={inputClass}>
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className={tourSlug === 'insurance' ? 'md:col-span-2' : 'md:col-span-3'}>
                        <label htmlFor="tour-destination" className="block text-sm font-semibold text-gray-700 mb-2">{tourSlug === 'insurance' ? 'Travelling to' : 'Destination'}</label>
                        <input id="tour-destination" type="text" value={tourForm.destination} onChange={e => setTourForm(f => ({ ...f, destination: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && tourReady) handleSearch('tourism'); }} placeholder="City, region or country" className={inputClass} />
                      </div>
                      {tourSlug === 'insurance' && (
                        <div>
                      <label htmlFor="tour-from" className="block text-sm font-semibold text-gray-700 mb-2">Travelling from <span className="text-gray-400 font-normal">(opt.)</span></label>
                      <select id="tour-from" value={tourForm.from} onChange={e => setTourForm(f => ({ ...f, from: e.target.value }))} className={inputClass}>
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </div>
                      )}
                    </>
                  )}
                  {searchBtn('tourism', !tourReady)}
                </div>
                <p className="-mt-2 mb-2 text-sm text-gray-600">Book through Lyrtrip: send your details and documents once, get one price (plus 5% service), and we arrange the rest. <Link href="/tours/requests" className="font-semibold text-brand-600">My requests →</Link></p>
                <TourismList />
                {bookTour && <TourRequestDialog item={bookTour} onClose={() => setBookTour(null)} />}
              </div>
            )}

            {/* Study */}
            {activeTab === 'study' && (() => {
              const choice = STUDY_OPTIONS.find(o => o.label === studyChoice) ?? STUDY_OPTIONS[0];
              const keywordHint = choice.id === 'study-academy' ? 'e.g. engineering, art, MBA' : choice.id === 'study-admission' ? 'e.g. MBA, nursing, Harvard' : 'e.g. computer science, women in STEM';
              return (
                <div>
                  <div className="mx-auto max-w-2xl">
                    {optionTiles(STUDY_OPTIONS, studyChoice, pickStudy, 'Study option', 'grid-cols-3')}
                  </div>
                  <p key={choice.id} className="-mt-2 mb-5 text-center text-sm text-gray-600 animate-[panelIn_250ms_ease-out]">{choice.blurb}</p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label htmlFor="study-level" className="block text-sm font-semibold text-gray-700 mb-2">Level</label>
                      <select id="study-level" value={studyForm.level} onChange={e => setStudyForm(f => ({ ...f, level: e.target.value }))} className={inputClass}>
                        <option value="">Any</option>
                        <option value="school">School</option>
                        <option value="college">College</option>
                        <option value="institute">Institute</option>
                        <option value="university">University</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="study-query" className="block text-sm font-semibold text-gray-700 mb-2">{choice.id === 'study-academy' ? 'Subject / Name' : 'Program / Field'}</label>
                      <input id="study-query" type="text" value={studyForm.query} onChange={e => setStudyForm(f => ({ ...f, query: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleSearch('study'); }} placeholder={keywordHint} className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="study-location" className="block text-sm font-semibold text-gray-700 mb-2">Location <span className="text-gray-400 font-normal">(worldwide)</span></label>
                      <input id="study-location" type="text" value={studyForm.location} onChange={e => setStudyForm(f => ({ ...f, location: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleSearch('study'); }} placeholder="City or country" className={inputClass} />
                    </div>
                    {searchBtn('study', choice.id === 'study-academy' && !studyForm.location.trim() && !studyForm.query.trim())}
                  </div>
                  <div className="mt-5 rounded-2xl bg-gradient-to-r from-brand-50 to-amber-50 ring-1 ring-brand-100 p-4 flex flex-wrap items-center gap-3">
                    <span className="text-3xl" aria-hidden>🎓</span>
                    <p className="flex-1 min-w-[220px] text-sm text-gray-700"><span className="font-bold text-gray-900">Apply through Lyrtrip.</span> Build your student profile once with every document, and we apply to schools and scholarships for you. Plans from $5 a month; institution fees plus 10% service.</p>
                    <Link href="/study/profile" className="px-4 py-2 rounded-xl bg-btn text-white text-sm font-semibold hover:bg-btn-hover">My student profile</Link>
                  </div>
                  <StudyList />
                  {applyStudy && <StudyApplyDialog item={applyStudy} onClose={() => setApplyStudy(null)} />}
                </div>
              );
            })()}

            {/* Events */}
            {activeTab === 'events' && (
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                  <div>
                    <label htmlFor="event-location" className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                    <div className="relative">
                      <input id="event-location" type="text" value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && eventForm.location.trim()) handleSearch('events'); }} placeholder="City or area, e.g. Whitefield, Bengaluru" className={`${inputClass} pr-24`} />
                      {uberCity && (
                        <button type="button" onClick={() => setEventForm(f => ({ ...f, location: uberCity }))} title={`Use my location: ${uberCity}`}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">📍 Near me</button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="event-category" className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                    <select id="event-category" value={eventForm.category} onChange={e => setEventForm(f => ({ ...f, category: e.target.value }))} className={inputClass}>
                      <option value="">All events</option>
                      {EVENT_CATEGORIES.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.items.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="event-query" className="block text-sm font-semibold text-gray-700 mb-2">Keywords <span className="text-gray-400 font-normal">(opt.)</span></label>
                    <input id="event-query" type="text" value={eventForm.query} onChange={e => setEventForm(f => ({ ...f, query: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter' && eventForm.location.trim()) handleSearch('events'); }} placeholder="Artist, team, show" className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="event-when" className="block text-sm font-semibold text-gray-700 mb-2">When</label>
                    <select id="event-when" value={eventForm.when} onChange={e => setEventForm(f => ({ ...f, when: e.target.value }))} className={inputClass}>
                      <option value="">Any date</option>
                      <option value="today">Today</option>
                      <option value="tomorrow">Tomorrow</option>
                      <option value="weekend">This weekend</option>
                      <option value="week">This week</option>
                      <option value="next_week">Next week</option>
                      <option value="month">Next 30 days</option>
                      <option value="next_month">Next month</option>
                    </select>
                  </div>
                  {searchBtn('events', !eventForm.location.trim())}
                </div>
                <div className="-mt-1 mb-3 flex flex-wrap gap-2" aria-label="Popular event types">
                  {EVENT_QUICK.map(([value, name]) => (
                    <button key={value} type="button" aria-pressed={eventForm.category === value} className={subPill(eventForm.category === value)}
                      onClick={() => { const location = eventForm.location.trim() || uberCity; setEventForm(f => ({ ...f, category: f.category === value ? '' : value, location })); }}>
                      {name}
                    </button>
                  ))}
                </div>
                <p className="mb-2 text-sm text-gray-600">Book tickets through Lyrtrip: we find them and send them to you. <Link href="/events/tickets" className="font-semibold text-brand-600">My tickets →</Link></p>
                <EventList />
                {applyEvent && <EventTicketDialog item={applyEvent} onClose={() => setApplyEvent(null)} />}
              </div>
            )}

            {/* Air charters sold through Lyrtrip: helicopter, seaplane and air ambulance */}
            {activeTab === 'helicopter' && <HelicopterPanel key="helicopter" service="helicopter" />}
            {activeTab === 'seaplane' && <HelicopterPanel key="seaplane" service="seaplane" />}
            {activeTab === 'airambulance' && <HelicopterPanel key="ambulance" service="ambulance" />}
            {activeTab === 'ambulance' && <HelicopterPanel key="roadambulance" service="roadambulance" />}

            {/* Charity: donations to established charities, and charity events */}
            {activeTab === 'charity' && (
              <CharityPanel onFindEvents={category => {
                switchTab('events');
                setEventForm(f => ({ ...f, category, location: f.location.trim() || uberCity }));
              }} />
            )}

            {/* Jobs (Career) */}
            {activeTab === 'career' && (
              <div>
                <JobProfilePromo />
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
                {applyJob && <JobApplyDialog job={applyJob} onClose={() => setApplyJob(null)} />}
              </div>
            )}

            {/* Shipping */}
            {activeTab === 'shipping' && (
              <ShippingTab user={user} />
            )}

            {/* Tax, legal and lawyer services sold through Lyrtrip */}
            {activeTab === 'tax' && <LegalPanel key="tax" service="tax" />}
            {activeTab === 'legal' && <LegalPanel key="legal" service="legal" />}
            {activeTab === 'lawyer' && <LegalPanel key="lawyer" service="lawyer" />}

            {/* Trucks, cargo and containers sold through Lyrtrip */}
            {activeTab === 'truck' && <FreightPanel key="truck" mode="truck" />}
            {activeTab === 'freight' && <FreightPanel key="freight" mode="freight" />}

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
                    <h2 className="text-xl font-bold text-gray-900">{t('Book Hotel')}</h2>
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
                      <div className="flex justify-between text-gray-600"><span>{nights === 1 ? t('Room, 1 night, incl. taxes & fees') : t('Room, {n} nights, incl. taxes & fees', { n: nights })}</span><span>{money(total - (fee ?? 0))}</span></div>
                      <div className="flex justify-between text-gray-600 mt-1"><span>{t('Lyrtrip service fee (12%)')}</span><span>{money(fee ?? 0)}</span></div>
                      <div className="flex justify-between font-bold text-gray-900 text-base mt-2 pt-2 border-t border-brand-100"><span>{t('Total')}</span><span className="text-end"><Price amount={total} /></span></div>
                      {!hotelServerQuote && <p className="text-xs text-gray-500 mt-2">Estimated from today&apos;s rate; the exact price is checked before you pay.</p>}
                    </>
                  ) : (
                    <p className="text-gray-600">{t('Choose your dates to see the price.')}</p>
                  )}
                </div>

                {d.hotel.propertyToken && (
                  <HotelPriceCompare
                    propertyToken={d.hotel.propertyToken}
                    destination={formData.destination}
                    checkin={d.checkin}
                    checkout={d.checkout}
                    adults={hotelForm.adults}
                    lyrtripTotal={total}
                  />
                )}

                <CheckoutExtras kind="hotel" listedTotal={total} currency="USD" signedIn={!!user}
                  value={extras} onChange={v => { setExtras(v); setHotelError(null); }} onQuote={setExtrasQuote} />

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
                    className="flex-1 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition"
                  >
                    {hotelSubmitting ? t('Checking price…') : total != null ? `${t('Pay {amount}', { amount: original(extrasQuote?.listedTotal === total ? extrasQuote.amountDue : total) })} →` : t('Continue')}
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
                    <h2 className="text-xl font-bold text-gray-900">{t('Book Flight')}</h2>
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
                        <p className="text-2xl font-bold text-brand-700"><Price amount={total} currency={f.currency ?? 'USD'} /></p>
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

                  <CheckoutExtras kind="flight" listedTotal={total} currency={f.currency ?? 'USD'} signedIn={!!user}
                    value={extras} onChange={v => { setExtras(v); setFlightBookingError(null); }} onQuote={setExtrasQuote} />

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
                      className="flex-1 py-2.5 bg-btn text-white rounded-xl font-semibold hover:bg-btn-hover disabled:bg-gray-300 transition flex items-center justify-center gap-2"
                    >
                      {flightBookingLoading ? (
                        <><span className="animate-spin">⟳</span> Processing…</>
                      ) : user ? (
                        `${t('Pay {amount}', { amount: original(extrasQuote?.listedTotal === total ? extrasQuote.amountDue : total, f.currency ?? 'USD') })} →`
                      ) : t('Sign in to Book')}
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
                <div className="bg-brand-50 rounded-lg p-3 mb-3 text-sm">
                  <div className="flex justify-between font-bold text-brand-700">
                    <span>{t('Total')}</span><span className="text-end"><Price amount={total} currency={f.currency ?? 'USD'} /></span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-4">This fare can&apos;t be ticketed on Lyrtrip. Book it with the airline or a travel agent through Google Flights.</p>
                <div className="flex gap-3">
                  <button onClick={() => setFlightDraft(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">Cancel</button>
                  <a href={`https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${first?.departure.airport ?? flightDraft.from} to ${last?.arrival.airport ?? flightDraft.to} on ${flightDraft.depart}`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2 text-center bg-btn text-white rounded-lg font-semibold hover:bg-btn-hover transition">
                    Book on Google Flights →
                  </a>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Ride modal: booking when live prices came back, otherwise estimates only */}
        {rideDraft && rideDraft.ride.price != null && (
          <RideBooking
            ride={{ ...rideDraft.ride, price: rideDraft.ride.price, currency: rideDraft.ride.currencyCode, pickupMinutes: rideDraft.ride.pickupMinutes ?? null }}
            pickup={{ lat: rideDraft.pickupLat, lng: rideDraft.pickupLng, label: rideDraft.pickupLabel }}
            dropoff={{ lat: rideDraft.dropoffLat, lng: rideDraft.dropoffLng, label: rideDraft.dropoffLabel }}
            user={user}
            onClose={() => setRideDraft(null)}
          />
        )}
        {rideDraft && rideDraft.ride.price == null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-xl font-bold text-gray-900">Book a ride</h2>
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

              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>{t('Fare (est.)')}</span>
                  <span>{money(rideDraft.ride.lowEstimate, rideDraft.ride.currencyCode || 'USD')}–{money(rideDraft.ride.highEstimate, rideDraft.ride.currencyCode || 'USD')}</span>
                </div>
                <p className="text-xs text-gray-500">An estimate. Booking rides on Lyrtrip opens soon; you won&apos;t be charged.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setRideDraft(null)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button disabled
                  className="flex-1 py-2 text-center bg-gray-200 text-gray-500 rounded-lg font-semibold cursor-not-allowed">
                  Booking opens soon
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
