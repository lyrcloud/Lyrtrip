import { createHmac } from 'node:crypto';
import Stripe from 'stripe';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { MongoClient, ObjectId } from 'mongodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';

// ---------------------------------------------------------------------------
// Flixbus API integration
// ---------------------------------------------------------------------------

const DEMO_BUS_JOURNEYS = [
  {
    id: 'demo-0',
    depOffset: new Date(Date.now() + 3600000).toISOString().replace('Z', ''),
    arrOffset: new Date(Date.now() + 3600000 * 10).toISOString().replace('Z', ''),
    depName: 'Origin City Bus Terminal',
    arrName: 'Destination City Bus Station',
    duration: '09:00',
    changeovers: 0,
    segments: [],
    deeplink: 'https://shop.flixbus.com',
    price: 29.99,
    currency: 'EUR',
    additionalInfo: null,
  },
  {
    id: 'demo-1',
    depOffset: new Date(Date.now() + 3600000 * 5).toISOString().replace('Z', ''),
    arrOffset: new Date(Date.now() + 3600000 * 16).toISOString().replace('Z', ''),
    depName: 'Origin City Bus Terminal',
    arrName: 'Destination City Bus Station',
    duration: '11:00',
    changeovers: 1,
    segments: [],
    deeplink: 'https://shop.flixbus.com',
    price: 19.99,
    currency: 'EUR',
    additionalInfo: '3 seats left at this price',
  },
];

async function searchBusFlixbus({ from, to, date, adult }) {
  const apiUrl = (process.env.FLIXBUS_API_URL ?? '').replace(/\/$/, '');
  const apiKey = process.env.FLIXBUS_API_KEY;
  if (!apiUrl || !apiKey) throw new Error('Flixbus API not configured');

  const headers = { 'x-api-key': apiKey, Accept: 'application/json' };

  const [fromRes, toRes] = await Promise.all([
    fetch(`${apiUrl}/v1/locations/autocomplete?query=${encodeURIComponent(from)}`, { headers }),
    fetch(`${apiUrl}/v1/locations/autocomplete?query=${encodeURIComponent(to)}`, { headers }),
  ]);

  const [fromData, toData] = await Promise.all([fromRes.json(), toRes.json()]);

  if (!Array.isArray(fromData) || fromData.length === 0) throw new Error(`No Flixbus location found for "${from}"`);
  if (!Array.isArray(toData)   || toData.length   === 0) throw new Error(`No Flixbus location found for "${to}"`);

  const fromId = fromData[0].id;
  const toId   = toData[0].id;

  // Convert YYYY-MM-DD → DD.MM.YYYY
  const [yr, mo, dy] = date.split('-');
  const flixDate = `${dy}.${mo}.${yr}`;

  const tripParams = new URLSearchParams({
    from_id:   fromId,
    to_id:     toId,
    date:      flixDate,
    time:      '00:00',
    adult:     String(adult || 1),
    search_by: 'cities',
    currency:  'EUR',
    locale:    'en',
  });

  const tripRes = await fetch(`${apiUrl}/v2/trips?${tripParams}`, { headers });
  if (!tripRes.ok) {
    const err = await tripRes.text();
    throw new Error(`Flixbus trip search failed (${tripRes.status}): ${err}`);
  }
  const tripData = await tripRes.json();

  return (tripData.journeys ?? []).map((j, i) => ({
    id:           String(i),
    depOffset:    j.dep_offset,
    arrOffset:    j.arr_offset,
    depName:      j.dep_name,
    arrName:      j.arr_name,
    duration:     j.duration,
    changeovers:  j.changeovers,
    segments:     (j.segments ?? []).map(s => ({
      dep_offset:   s.dep_offset,
      dep_name:     s.dep_name,
      arr_offset:   s.arr_offset,
      arr_name:     s.arr_name,
      product_type: s.product_type,
      product:      s.product,
    })),
    deeplink:      j.deeplink,
    price:         j.fares?.[0]?.price ?? null,
    currency:      j.fares?.[0]?.currency ?? 'EUR',
    additionalInfo: j.fares?.[0]?.additional_info ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Mock fallback data (used when real API keys are not configured)
// ---------------------------------------------------------------------------

function makeMockFlights(from, to, depart) {
  const orig = resolveIata(from) || 'JFK';
  const dest = resolveIata(to)   || 'LAX';
  const date = depart || new Date().toISOString().slice(0, 10);
  const note = 'Sample pricing — live search temporarily unavailable';
  const leg = (dep, arr, depTime, arrTime, dur, airline, fn) => ({
    airline,
    airlineLogo: null,
    flightNumber: fn,
    departure: { airport: dep, name: dep, time: `${date} ${depTime}` },
    arrival:   { airport: arr, name: arr, time: `${date} ${arrTime}` },
    duration: dur,
    airplane: 'Boeing 737',
    travelClass: 'Economy',
    extensions: [],
  });
  return [
    {
      id: 'mock-1', type: 'flight', isBest: true, name: 'Delta Air Lines',
      description: `${orig} → ${dest}`, price: 189, totalPrice: 189, totalDuration: 360,
      airlineLogo: null, layovers: [], extensions: [note],
      legs: [leg(orig, dest, '08:00', '14:00', 360, 'Delta Air Lines', 'DL 402')],
    },
    {
      id: 'mock-2', type: 'flight', isBest: true, name: 'United Airlines',
      description: `${orig} → ${dest}`, price: 219, totalPrice: 219, totalDuration: 390,
      airlineLogo: null, layovers: [], extensions: [note],
      legs: [leg(orig, dest, '10:30', '16:30', 390, 'United Airlines', 'UA 1189')],
    },
    {
      id: 'mock-3', type: 'flight', isBest: false, name: 'American Airlines',
      description: `${orig} → ${dest}`, price: 249, totalPrice: 249, totalDuration: 420,
      airlineLogo: null, layovers: [], extensions: [note],
      legs: [leg(orig, dest, '13:00', '19:00', 420, 'American Airlines', 'AA 321')],
    },
  ];
}

const mockData = {
  hotels: [
    { id: '1', name: 'Luxury Palace Hotel', description: '5-star hotel with ocean view', rating: 4.8, price: 250, unit: '/night' },
    { id: '2', name: 'Downtown Inn', description: 'Modern boutique hotel in city center', rating: 4.5, price: 120, unit: '/night' },
    { id: '3', name: 'Budget Stay', description: 'Affordable accommodation with good service', rating: 4.2, price: 65, unit: '/night' },
  ],
  flights: [],
  car: [
    { id: '1', name: 'Premium Car Rental - Tesla Model 3', description: 'Electric vehicle, luxury experience', rating: 4.9, price: 120, unit: '/day' },
    { id: '2', name: 'Standard Sedan - Toyota Camry', description: 'Reliable and comfortable', rating: 4.5, price: 55, unit: '/day' },
    { id: '3', name: 'Economy Car - Hyundai i20', description: 'Budget-friendly option', rating: 4.3, price: 35, unit: '/day' },
  ],
  bus: [
    { id: '1', name: 'Premium Bus - VIP Coach', description: 'Luxury seats, AC, WiFi, Meals included', rating: 4.7, price: 95 },
    { id: '2', name: 'Express Bus Service', description: 'Direct route, Comfortable seats', rating: 4.4, price: 55 },
    { id: '3', name: 'Economy Bus', description: 'Standard seating, Basic amenities', rating: 4.1, price: 25 },
  ],
  train: [
    { id: '1', name: 'High Speed Train - First Class', description: 'Ultra-fast, Private cabin, Meals', rating: 4.8, price: 180 },
    { id: '2', name: 'Express Train - Business Class', description: 'Fast service, Comfortable seating', rating: 4.6, price: 95 },
    { id: '3', name: 'Standard Train', description: 'Economy travel with good amenities', rating: 4.2, price: 45 },
  ],
  cruise: [
    { id: '1', name: 'Caribbean Paradise Cruise', description: '7 days, All-inclusive, Entertainment', rating: 4.9, price: 1200 },
    { id: '2', name: 'Mediterranean Cruise', description: '10 days, Multiple ports, Luxury cabins', rating: 4.7, price: 2000 },
    { id: '3', name: 'Budget Cruise Adventure', description: '4 days, Beautiful destinations, Fun activities', rating: 4.3, price: 450 },
  ],
  dash: [
    { id: '1', name: 'Italian Pizzeria - Mama Mia', description: 'Authentic Italian pizza and pasta, 30-45 min delivery', rating: 4.8, price: 35 },
    { id: '2', name: 'Asian Fusion - Dragon Palace', description: 'Chinese, Thai, Vietnamese fusion cuisine', rating: 4.6, price: 28 },
    { id: '3', name: 'Burger & Fries Heaven', description: 'Gourmet burgers, hand-cut fries, shakes', rating: 4.5, price: 22 },
  ],
  tourism: [
    { id: '1', name: 'Eiffel Tower Tour', description: 'Guided tour with skip-the-line tickets, 3 hours', rating: 4.9, price: 95 },
    { id: '2', name: 'Local City Walking Tour', description: 'Explore hidden gems with local guide, 2.5 hours', rating: 4.6, price: 45 },
    { id: '3', name: 'Museum Pass - 24 Hours', description: 'Access to 5 major museums with guide', rating: 4.7, price: 85 },
  ],
  study: [],
  career: [
    { id: '1', name: 'Senior Software Engineer', company: 'Google', jobLocation: 'Remote / Mountain View, CA', salary: '$180,000–220,000/yr', jobType: 'Full-time', postedAt: '2 days ago', description: 'Build and scale distributed systems powering Google\'s core products. 5+ years experience required.' },
    { id: '2', name: 'Product Manager', company: 'Meta', jobLocation: 'Menlo Park, CA', salary: '$150,000–190,000/yr', jobType: 'Full-time', postedAt: '1 day ago', description: 'Drive product strategy and execution for flagship consumer applications. MBA or equivalent preferred.' },
    { id: '3', name: 'UX Designer', company: 'Apple', jobLocation: 'Cupertino, CA', salary: '$130,000–160,000/yr', jobType: 'Full-time', postedAt: '3 days ago', description: 'Shape delightful user experiences across iOS and macOS platforms. Portfolio required.' },
  ],
};

// ---------------------------------------------------------------------------
// Amadeus Hotel API integration
// ---------------------------------------------------------------------------

let amadeusToken = null;
let amadeusTokenExpiry = 0;

function amadeusBaseUrl() {
  return process.env.AMADEUS_ENV === 'production'
    ? 'https://api.amadeus.com'
    : 'https://test.api.amadeus.com';
}

async function getAmadeusToken() {
  if (amadeusToken && Date.now() < amadeusTokenExpiry - 60_000) {
    return amadeusToken;
  }

  const res = await fetch(`${amadeusBaseUrl()}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_CLIENT_ID,
      client_secret: process.env.AMADEUS_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Amadeus auth failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  amadeusToken = data.access_token;
  amadeusTokenExpiry = Date.now() + data.expires_in * 1000;
  return amadeusToken;
}

async function searchHotelsAmadeus({ lat, lng, checkin, checkout }) {
  const token = await getAmadeusToken();
  const base = amadeusBaseUrl();
  const headers = { Authorization: `Bearer ${token}` };

  // Step 1 — find hotels near the geocode
  const byGeoParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    radius: '5',
    radiusUnit: 'KM',
    ratings: '3,4,5',
  });

  const hotelsRes = await fetch(
    `${base}/v1/reference-data/locations/hotels/by-geocode?${byGeoParams}`,
    { headers }
  );

  if (!hotelsRes.ok) {
    const err = await hotelsRes.text();
    throw new Error(`Amadeus hotel list failed (${hotelsRes.status}): ${err}`);
  }

  const hotelsData = await hotelsRes.json();
  if (!hotelsData.data?.length) return [];

  // Take up to 20 IDs (Amadeus limit per offers call)
  const hotelIds = hotelsData.data.slice(0, 20).map(h => h.hotelId).join(',');

  // Step 2 — get offers with optional date range
  const offerParams = new URLSearchParams({
    hotelIds,
    adults: '1',
    bestRateOnly: 'true',
    currency: 'USD',
  });
  if (checkin)  offerParams.set('checkInDate', checkin);
  if (checkout) offerParams.set('checkOutDate', checkout);

  const offersRes = await fetch(
    `${base}/v3/shopping/hotel-offers?${offerParams}`,
    { headers }
  );

  if (!offersRes.ok) {
    const err = await offersRes.text();
    throw new Error(`Amadeus hotel offers failed (${offersRes.status}): ${err}`);
  }

  const offersData = await offersRes.json();
  if (!offersData.data?.length) return [];

  return offersData.data.map(item => {
    const hotel = item.hotel ?? {};
    const offer  = item.offers?.[0];
    const addr   = [
      hotel.address?.lines?.join(', '),
      hotel.address?.cityName,
      hotel.address?.countryCode,
    ].filter(Boolean).join(', ');

    return {
      id:          hotel.hotelId ?? item.type,
      name:        hotel.name ?? 'Hotel',
      description: addr || 'No address available',
      rating:      hotel.rating ? Number(hotel.rating) : undefined,
      price:       offer?.price?.total ? Number(offer.price.total) : undefined,
      currency:    offer?.price?.currency ?? 'USD',
      unit:        '/night',
      roomType:    offer?.room?.typeEstimated?.category ?? undefined,
      bedType:     offer?.room?.typeEstimated?.bedType  ?? undefined,
    };
  });
}

// ---------------------------------------------------------------------------
// Travelport TripServices integration
// ---------------------------------------------------------------------------

// TRAVELPORT_ENV=production switches to live Travelport; anything else uses pre-production
const TVPT_LIVE       = process.env.TRAVELPORT_ENV === 'production';
const TVPT_HOST       = TVPT_LIVE ? 'travelport.net' : 'pp.travelport.net';
const TVPT_AUTH_URL   = `https://auth.${TVPT_HOST}/oauth/token`;
const TVPT_AIR_BASE   = `https://api.${TVPT_HOST}/11/air`;
const TVPT_HOTEL_BASE = `https://api.${TVPT_HOST}/11/hotel`;

// TRAVELPORT_PREVIEW=true: show Travelport results on the live site but take no bookings
const TVPT_PREVIEW = process.env.TRAVELPORT_PREVIEW === 'true';
// TRAVELPORT_TEST_SITE=true: full booking flow against Travelport pre-production, paid
// with a Stripe TEST key (TRAVELPORT_STRIPE_SECRET_KEY) — test cards only, no real money
const TVPT_TEST_SITE = process.env.TRAVELPORT_TEST_SITE === 'true';
const tvptMarkPreview = results =>
  TVPT_PREVIEW ? results.map(r => ({ ...r, preview: true }))
  : TVPT_TEST_SITE ? results.map(r => ({ ...r, testBooking: true }))
  : results;

// Travelport bookings can be paid through a separate Stripe account/key
const tvptStripeKey = () => process.env.TRAVELPORT_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

// Never take real money for a booking in Travelport's test system
function tvptPaymentModeError() {
  if (TVPT_PREVIEW) return 'Online booking is not available yet. Please check back soon.';
  const liveStripe = /^(sk|rk)_live_/.test(tvptStripeKey() ?? '');
  if (liveStripe && !TVPT_LIVE) {
    return 'Online booking is not available yet. Please check back soon.';
  }
  return null;
}

// Configurable commission markup applied on top of Travelport base fare
const TVPT_AIR_MARKUP   = parseFloat(process.env.TRAVELPORT_AIR_MARKUP   || '1.12'); // 12%
const TVPT_HOTEL_MARKUP = parseFloat(process.env.TRAVELPORT_HOTEL_MARKUP || '1.12'); // 12%

// Where Stripe sends the customer back to (override for local/staging testing)
const SITE_URL = (process.env.SITE_URL || 'https://www.lyrtrip.com').replace(/\/$/, '');

let tvptToken       = null;
let tvptTokenExpiry = 0;

async function getTvptToken() {
  if (tvptToken && Date.now() < tvptTokenExpiry - 60_000) return tvptToken;
  const res = await fetch(TVPT_AUTH_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'password',
      username:      process.env.TRAVELPORT_USERNAME      ?? '',
      password:      process.env.TRAVELPORT_PASSWORD      ?? '',
      client_id:     process.env.TRAVELPORT_CLIENT_ID     ?? '',
      client_secret: process.env.TRAVELPORT_CLIENT_SECRET ?? '',
    }),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(`Travelport auth (${res.status}): ${e}`); }
  const d = await res.json();
  tvptToken       = d.access_token;
  tvptTokenExpiry = Date.now() + d.expires_in * 1000;
  return tvptToken;
}

async function tvptAirFetch(path, body = null, method = 'POST') {
  const token = await getTvptToken();
  const hdrs  = {
    'Authorization':                `Bearer ${token}`,
    'XAUTH_TRAVELPORT_ACCESSGROUP': process.env.TRAVELPORT_ACCESS_GROUP ?? '',
    'Accept':          'application/json',
    'Accept-Encoding': 'gzip',
    'Cache-Control':   'no-cache',
    'Accept-Version':  '11',
    'Content-Version': '11',
  };
  if (body) hdrs['Content-Type'] = 'application/json';
  const res = await fetch(`${TVPT_AIR_BASE}${path}`, { method, headers: hdrs, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const e = await res.text(); throw new Error(`Travelport Air ${method} ${path} (${res.status}): ${e}`); }
  return res.json();
}

async function tvptHotelFetch(path, body = null, method = 'POST') {
  const token = await getTvptToken();
  const hdrs  = {
    'Authorization':                `Bearer ${token}`,
    'XAUTH_TRAVELPORT_ACCESSGROUP': process.env.TRAVELPORT_ACCESS_GROUP ?? '',
    'Accept':          'application/json',
    'Accept-Encoding': 'gzip',
    'Cache-Control':   'no-cache',
  };
  if (body) hdrs['Content-Type'] = 'application/json';
  const res = await fetch(`${TVPT_HOTEL_BASE}${path}`, { method, headers: hdrs, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) { const e = await res.text(); throw new Error(`Travelport Hotel ${method} ${path} (${res.status}): ${e}`); }
  return res.json();
}

// Search flights — returns results in the same shape as Duffel, plus _tvpt booking metadata
async function searchFlightsTravelport({ from, to, depart, returnDate, passengers = 1 }) {
  const origin = resolveIata(from) || from.toUpperCase().slice(0, 3);
  const dest   = resolveIata(to)   || to.toUpperCase().slice(0, 3);

  const searchLegs = [
    { '@type': 'SearchCriteriaFlight', departureDate: depart, From: { value: origin }, To: { value: dest } },
  ];
  if (returnDate) {
    searchLegs.push({ '@type': 'SearchCriteriaFlight', departureDate: returnDate, From: { value: dest }, To: { value: origin } });
  }

  const data = await tvptAirFetch('/catalog/search/catalogproductofferings', {
    CatalogProductOfferingsQueryRequest: {
      CatalogProductOfferingsRequest: {
        '@type':                    'CatalogProductOfferingsRequestAir',
        offersPerPage:              20,
        maxNumberOfUpsellsToReturn: 0,
        // GDS only: booking and ticketing below use the GDS workflow (NDC orders differ)
        contentSourceList:          ['GDS'],
        PassengerCriteria:          [{ '@type': 'PassengerCriteria', number: passengers, passengerTypeCode: 'ADT' }],
        SearchCriteriaFlight:       searchLegs,
        PricingModifiersAir:        { '@type': 'PricingModifiersAir', currencyCode: 'USD' },
      },
    },
  });

  const resp = data.CatalogProductOfferingsResponse ?? {};
  const wrap = resp.CatalogProductOfferings ?? {};
  // Errors can accompany valid offers (e.g. one content source failing); only fail when nothing came back
  if (!wrap.CatalogProductOffering?.length && resp.Result?.Error?.length) {
    throw new Error(resp.Result.Error[0].Message ?? 'Travelport search error');
  }

  const sessionId = wrap.Identifier?.value ?? '';
  const offerings = wrap.CatalogProductOffering ?? [];

  // Build flight segment lookup from ReferenceList
  const flightLookup = {};
  for (const g of resp.ReferenceList ?? []) {
    if (g['@type'] === 'ReferenceListFlight') {
      for (const f of g.Flight ?? []) flightLookup[f.id] = f;
    }
  }

  return offerings.map((o, i) => {
    const pbos  = o.ProductBrandOptions?.[0] ?? {};
    const pbo   = pbos.ProductBrandOffering?.[0] ?? {};
    const price = pbo.BestCombinablePrice ?? {};
    const frefs = pbos.flightRefs ?? [];

    const legs = frefs.map(fr => {
      const f   = flightLookup[fr] ?? {};
      const dep = f.Departure ?? {};
      const arr = f.Arrival   ?? {};
      return {
        airline:      f.carrier ?? '?',
        airlineLogo:  null,
        flightNumber: `${f.carrier ?? ''}${f.number ?? ''}`,
        departure: {
          airport: dep.AirportCode?.value ?? dep.location ?? o.Departure,
          name:    dep.AirportCode?.value ?? dep.location ?? o.Departure,
          time:    dep.value ?? '',
        },
        arrival: {
          airport: arr.AirportCode?.value ?? arr.location ?? o.Arrival,
          name:    arr.AirportCode?.value ?? arr.location ?? o.Arrival,
          time:    arr.value ?? '',
        },
        duration:    f.duration ? parseDuffelDuration(f.duration) : 0,
        airplane:    f.equipment ?? '',
        travelClass: 'Economy',
        extensions:  [],
      };
    });

    const base     = price.Base ?? 0;
    // Markup applies to the full fare (base + taxes) — the airline collects both
    const markedUp = Math.ceil((price.TotalPrice ?? base) * TVPT_AIR_MARKUP * 100) / 100;

    return {
      id:            `tvpt_${sessionId}_${o.id}`,
      type:          'flight',
      isBest:        i === 0,
      name:          legs[0]?.airline ?? 'GDS Flight',
      description:   `${o.Departure} → ${o.Arrival}`,
      price:         Math.ceil((markedUp / passengers) * 100) / 100,
      totalPrice:    markedUp,
      totalDuration: legs.reduce((s, l) => s + (l.duration ?? 0), 0),
      airlineLogo:   null,
      layovers:      frefs.length > 1 ? frefs.slice(1).map(() => ({})) : [],
      extensions:    ['GDS fare · all taxes included'],
      legs,
      // Booking metadata — kept in response so frontend can pass to checkout
      _tvpt: {
        sessionId,
        offeringId:    o.id,
        productId:     pbo.Product?.[0]?.productRef ?? 'p0',
        contentSource: pbo.ContentSource ?? 'GDS',
        basePrice:     base,
        currency:      price.CurrencyCode?.value ?? 'USD',
      },
    };
  });
}

const titleCase = s => (s ?? '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

// Hotels near a coordinate — returns results in the same shape as SerpAPI hotels, plus _tvptHotel keys
async function searchHotelsTravelport({ lat, lng, checkin, checkout, guests = 1 }) {
  const data = await tvptHotelFetch('/search/properties/search', {
    PropertiesQuerySearch: {
      CheckInDate:    checkin,
      CheckOutDate:   checkout,
      AggregatorList: ['TVPT'],
      RoomStayCandidate: [{
        '@type':     'RoomStayCandidate',
        GuestCounts: { '@type': 'GuestCounts', GuestCount: [{ '@type': 'GuestCount', count: Number(guests) || 1 }] },
      }],
      SearchBy: {
        '@type':      'SearchByGeoLocation',
        SearchRadius: { value: '10', unitOfDistance: 'Miles' },
        Latitude:     String(lat),
        Longitude:    String(lng),
      },
    },
  });

  const props = data.PropertiesResponse?.Properties?.PropertyInfo ?? [];
  return props
    // Only properties with a bookable rate for these dates
    .filter(pi => pi.LowestAvailableRate?.value && pi.availability !== 'Closed')
    .slice(0, 30)
    .map(pi => {
      const p    = pi.Property ?? {};
      const addr = p.Address ?? {};
      const key  = p.PropertyKey ?? {};
      const stars = p.Rating?.find(r => r.provider === 'AAA')?.value ?? p.Rating?.[0]?.value;
      return {
        id:            `tvpth_${key.chainCode}_${key.propertyCode}`,
        name:          p.name === p.name?.toUpperCase() ? titleCase(p.name) : p.name,
        description:   [...(addr.AddressLine ?? []), addr.City, addr.StateProv?.value].filter(Boolean).join(', '),
        rating:        stars,
        hotelClass:    stars,
        // Lowest nightly rate before taxes; the room list shows the full price incl. taxes
        pricePerNight: Math.ceil(pi.LowestAvailableRate.value * TVPT_HOTEL_MARKUP),
        currency:      pi.LowestAvailableRate.code ?? 'USD',
        imageUrl:      p.Image?.[0]?.value,
        amenities:     (p.PropertyAmenity ?? []).map(a => a.description).filter(Boolean).slice(0, 6),
        _tvptHotel:    { chainCode: key.chainCode, propertyCode: key.propertyCode, distanceMiles: pi.Distance?.value },
      };
    });
}

// Room offers for one property. Prices include taxes; the charge is marked up on TotalPrice.
async function tvptHotelRooms({ chainCode, propertyCode, checkin, checkout, guests = 1 }) {
  const data = await tvptHotelFetch('/availability/catalogofferingshospitality', {
    CatalogOfferingsQueryRequest: {
      CatalogOfferingsRequest: [{
        '@type':           'CatalogOfferingsRequestHospitality',
        requestedCurrency: 'USD',
        StayDates:         { start: checkin, end: checkout },
        HotelSearchCriterion: {
          '@type':         'HotelSearchCriterion',
          numberOfRooms:   1,
          AggregatorList:  ['TVPT'],
          PropertyRequest: [{ '@type': 'PropertyRequest', PropertyKey: { '@type': 'PropertyKey', chainCode, propertyCode } }],
          RoomStayCandidates: {
            '@type': 'RoomStayCandidates',
            RoomStayCandidate: [{
              '@type': 'RoomStayCandidate',
              GuestCounts: {
                '@type': 'GuestCounts',
                GuestCount: [{ '@type': 'GuestCount', count: String(Number(guests) || 1), ageQualifyingCode: '10' }],
              },
            }],
          },
        },
      }],
    },
  });

  const resp = data.CatalogOfferingsHospitalityResponse ?? {};
  const err  = resp.Result?.Error?.[0];
  if (err && !resp.CatalogOfferings) throw Object.assign(new Error(err.Message ?? 'Hotel availability failed'), { status: 400 });

  const nights = Math.max(1, Math.round((new Date(checkout) - new Date(checkin)) / 86_400_000));
  return (resp.CatalogOfferings?.CatalogOffering ?? []).map(o => {
    const prod    = o.ProductOptions?.[0]?.Product?.[0] ?? {};
    const room    = prod.RoomType ?? {};
    const chars   = room.RoomCharacteristics ?? {};
    const bed     = chars.BedConfiguration?.[0] ?? {};
    const tc      = o.TermsAndConditions ?? {};
    const penalty = tc.CancelPenalty?.[0] ?? {};
    const price   = o.Price ?? {};
    const supplierTotal = price.TotalPrice ?? price.Base ?? 0;
    const total   = Math.ceil(supplierTotal * TVPT_HOTEL_MARKUP * 100) / 100;
    return {
      offerId:        o.id ?? o.Identifier?.value,
      bookingCode:    prod.bookingCode ?? '',
      name:           [room.Description?.value, bed.quantity && bed.bedType ? `${bed.quantity} × ${bed.bedType}` : bed.bedType].filter(Boolean).join(' · ') || 'Room',
      rateDescription: (tc.Description ?? []).map(d => d.value ?? d).filter(v => typeof v === 'string').join(' ').slice(0, 300),
      smoking:        chars.smokingAllowed,
      refundable:     penalty.Refundable !== 'No',
      cancelPolicy:   penalty.Description ?? '',
      guaranteeType:  tc.Guarantee?.[0]?.guaranteeType ?? '',
      nights,
      supplierTotal,
      taxes:          price.TotalTaxes ?? 0,
      total,
      perNight:       Math.ceil((total / nights) * 100) / 100,
      currency:       price.CurrencyCode?.value ?? 'USD',
    };
  }).sort((a, b) => a.total - b.total);
}

async function handleTravelportHotelRooms(event) {
  if (!process.env.TRAVELPORT_CLIENT_ID) return json(500, { error: 'Travelport is not configured' });
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { chainCode, propertyCode, checkin, checkout, guests = 1 } = body;
  if (!chainCode || !propertyCode || !checkin || !checkout) {
    return json(400, { error: 'chainCode, propertyCode, checkin and checkout are required' });
  }
  try {
    const rooms = await tvptHotelRooms({ chainCode, propertyCode, checkin, checkout, guests });
    // offerId and supplier cost stay on the server
    return json(200, { rooms: rooms.map(({ offerId: _o, supplierTotal: _s, ...r }) => r) });
  } catch (err) {
    return json(err.status ?? 500, { error: err.message });
  }
}

// Price a catalog offering with Travelport. The charge is always computed here from
// Travelport's TotalPrice (base + taxes), never from a price sent by the browser.
async function tvptPriceOffering({ sessionId, offeringId, productId = 'p0', passengers = 1 }) {
  const data = await tvptAirFetch('/price/offers/buildfromcatalogproductofferings', {
    OfferQueryBuildFromCatalogProductOfferings: {
      BuildFromCatalogProductOfferingsRequestAir: {
        '@type': 'BuildFromCatalogProductOfferingsRequestAir',
        CatalogProductOfferingsIdentifier: { Identifier: { value: sessionId } },
        CatalogProductOfferingSelection: [{
          CatalogProductOfferingIdentifier: { Identifier: { value: offeringId } },
          ProductIdentifier: [{ Identifier: { value: productId } }],
        }],
        PassengerCriteria: [{ '@type': 'PassengerCriteria', passengerTypeCode: 'ADT', number: passengers }],
      },
    },
  });

  const resp   = data.OfferListResponse ?? {};
  const errors = resp.Result?.Error;
  if (errors?.length) throw Object.assign(new Error(errors[0].Message ?? 'Pricing failed'), { status: 400 });

  const offer   = resp.OfferID?.[0] ?? {};
  const price   = offer.Price ?? {};
  const product = offer.Product?.[0] ?? {};
  const base    = price.Base ?? 0;
  const total   = price.TotalPrice ?? base;
  return {
    // Strip _PC suffix from identifier so it can be used in subsequent workbench calls
    pricedSessionId: (resp.Identifier?.value ?? sessionId).replace(/_PC$/, ''),
    offerId:         offer.id ?? 'o0',
    productId:       product.id ?? productId,
    product,
    basePrice:       base,
    taxes:           price.TotalTaxes ?? Math.round((total - base) * 100) / 100,
    supplierTotal:   total,
    markedUpPrice:   Math.ceil(total * TVPT_AIR_MARKUP * 100) / 100,
    currency:        price.CurrencyCode?.value ?? 'USD',
  };
}

// Price a specific offer (step between search and checkout)
async function handleTravelportAirPrice(event) {
  if (!process.env.TRAVELPORT_CLIENT_ID) return json(500, { error: 'Travelport is not configured' });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { sessionId, offeringId, productId = 'p0', passengers = 1 } = body;
  if (!sessionId || !offeringId) return json(400, { error: 'sessionId and offeringId are required' });

  let priced;
  try {
    priced = await tvptPriceOffering({ sessionId, offeringId, productId, passengers });
  } catch (err) {
    return json(err.status ?? 500, { error: err.message });
  }
  const { product } = priced;

  const segments = (product.FlightSegment ?? []).map(seg => {
    const f   = seg.Flight ?? {};
    const dep = f.Departure ?? {};
    const arr = f.Arrival   ?? {};
    return {
      carrier:       f.carrier,
      flightNumber:  `${f.carrier ?? ''}${f.number ?? ''}`,
      from:          dep.location,
      to:            arr.location,
      departureDate: dep.date,
      departureTime: dep.time,
      arrivalDate:   arr.date,
      arrivalTime:   arr.time,
      duration:      f.duration,
      aircraft:      f.equipment,
    };
  });

  return json(200, {
    pricedSessionId: priced.pricedSessionId,
    offerId:         priced.offerId,
    productId:       priced.productId,
    basePrice:       priced.basePrice,
    markedUpPrice:   priced.markedUpPrice,
    currency:        priced.currency,
    taxes:           priced.taxes,
    totalPaid:       priced.markedUpPrice,
    segments,
    fareClass: product.PassengerFlight?.[0]?.FlightProduct?.[0]?.classOfService,
    cabin:     product.PassengerFlight?.[0]?.FlightProduct?.[0]?.cabin ?? 'Economy',
    fareBasis: product.PassengerFlight?.[0]?.FlightProduct?.[0]?.fareBasisCode,
  });
}

// Create workbench + Stripe checkout session for a Travelport flight
async function handleTravelportFlightCheckout(event) {
  const secretKey = tvptStripeKey();
  if (!secretKey)                          return json(500, { error: 'Stripe is not configured' });
  if (!process.env.TRAVELPORT_CLIENT_ID)  return json(500, { error: 'Travelport is not configured' });
  const modeError = tvptPaymentModeError();
  if (modeError) return json(503, { error: modeError });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { sessionId, offeringId, productId = 'p0', passengers, flightSummary } = body;

  if (!sessionId || !offeringId)                                 return json(400, { error: 'sessionId and offeringId are required' });
  if (!Array.isArray(passengers) || passengers.length === 0)    return json(400, { error: 'passengers array is required' });
  if (passengers.some(p => !p.givenName?.trim() || !p.familyName?.trim() || !p.dob || !p.email?.trim())) {
    return json(400, { error: 'Every passenger needs a given name, family name, date of birth and email' });
  }

  // Step 0 — price on the server; this is the amount we charge
  let priced;
  try {
    priced = await tvptPriceOffering({ sessionId, offeringId, productId, passengers: passengers.length });
  } catch (err) {
    return json(err.status ?? 500, { error: `Could not confirm fare: ${err.message}` });
  }
  const { pricedSessionId, offerId } = priced;

  // Step 1 — create reservation workbench
  let workbenchId;
  try {
    const wbRes = await tvptAirFetch('/book/session/reservationworkbench', { ReservationID: {} });
    workbenchId = wbRes.ReservationResponse?.Reservation?.Identifier?.value;
    if (!workbenchId) throw new Error('No workbench ID in response');
  } catch (err) {
    return json(500, { error: `Workbench creation failed: ${err.message}` });
  }

  // Step 2 — add the priced offer to the workbench
  try {
    await tvptAirFetch(`/book/airoffer/reservationworkbench/${workbenchId}/offers/buildfromcatalogproductofferings`, {
      OfferQueryBuildFromCatalogProductOfferings: {
        BuildFromCatalogProductOfferingsRequest: {
          '@type': 'BuildFromCatalogProductOfferingsRequestAir',
          CatalogProductOfferingsIdentifier: { Identifier: { value: pricedSessionId } },
          CatalogProductOfferingSelection: [{
            CatalogProductOfferingIdentifier: { Identifier: { value: offerId } },
            ProductIdentifier: [{ Identifier: { value: priced.productId } }],
          }],
        },
      },
    });
  } catch (err) {
    return json(500, { error: `Add offer to workbench failed: ${err.message}` });
  }

  const basePrice   = priced.basePrice;
  const markedUp    = priced.markedUpPrice;
  const amountCents = Math.round(markedUp * 100);
  const currency    = priced.currency;
  const numPax      = passengers.length;

  const db  = await getDb();
  const now = new Date().toISOString();

  const result  = await db.collection('flight_bookings').insertOne({
    status:          'pending_stripe',
    provider:        'travelport',
    workbenchId,
    pricedSessionId,
    offerId,
    productId:       priced.productId,
    passengers,
    flightSummary:   { ...(flightSummary ?? {}), basePrice, taxes: priced.taxes, supplierTotal: priced.supplierTotal, currency },
    basePrice,
    taxes:           priced.taxes,
    supplierTotal:   priced.supplierTotal,
    markedUpPrice:   markedUp,
    currency,
    numPassengers:   numPax,
    createdAt:       now,
    updatedAt:       now,
  });
  const orderId = result.insertedId.toString();

  const stripe  = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  const session = await stripe.checkout.sessions.create({
    mode:                 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:    currency.toLowerCase(),
        unit_amount: amountCents,
        product_data: {
          name:        `${TVPT_LIVE ? '' : '[TEST] '}${flightSummary?.airline ?? 'Flight'} — ${flightSummary?.route ?? 'Flight'}`,
          description: `${numPax} passenger${numPax !== 1 ? 's' : ''} · all taxes & Lyrtrip service fee included`,
        },
      },
      quantity: 1,
    }],
    metadata:       { type: 'travelport_flight', flightOrderId: orderId },
    customer_email: passengers[0]?.email || undefined,
    success_url:    `${SITE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&type=travelport_flight`,
    cancel_url:     `${SITE_URL}/booking/cancel`,
  });

  await db.collection('flight_bookings').updateOne(
    { _id: result.insertedId },
    { $set: { stripeSessionId: session.id, updatedAt: new Date().toISOString() } }
  );

  return json(200, { url: session.url, orderId });
}

// Flight segments exactly as the airline holds them, from a Travelport reservation
function tvptItinerary(reservation) {
  const product = reservation.Offer?.[0]?.Product?.[0] ?? {};
  const pf      = product.PassengerFlight?.[0]?.FlightProduct ?? [];
  return (product.FlightSegment ?? []).map((seg, i) => {
    const f   = seg.Flight ?? {};
    const dep = f.Departure ?? {};
    const arr = f.Arrival ?? {};
    const fp  = pf.find(p => (p.segmentSequence ?? []).includes(seg.sequence)) ?? pf[i] ?? pf[0] ?? {};
    return {
      carrier:       f.carrier,
      flightNumber:  `${f.carrier ?? ''}${f.number ?? ''}`,
      operatingCarrier: f.operatingCarrier ?? null,
      from:          dep.location,
      to:            arr.location,
      departureDate: dep.date,
      departureTime: (dep.time ?? '').slice(0, 5),
      arrivalDate:   arr.date,
      arrivalTime:   (arr.time ?? '').slice(0, 5),
      duration:      f.duration ? parseDuffelDuration(f.duration) : null,
      aircraft:      f.equipment ?? null,
      cabin:         fp.cabin ?? 'Economy',
      bookingClass:  fp.classOfService ?? null,
      fareBasis:     fp.fareBasisCode ?? null,
    };
  });
}

// Issue e-tickets for a held GDS booking. The agency pays the airline through its
// settlement plan (ARC/BSP), so the form of payment to the airline is cash/agency.
async function tvptIssueTickets({ locator, offerId, amount, currency }) {
  const wb = (await tvptAirFetch(`/book/session/reservationworkbench/buildfromlocator?Locator=${encodeURIComponent(locator)}`))
    .ReservationResponse?.Reservation?.Identifier?.value;
  if (!wb) throw new Error('Could not open ticketing workbench');

  const fopRes = await tvptAirFetch(`/payment/reservationworkbench/${wb}/formofpayment`, {
    FormOfPaymentCash: { '@type': 'FormOfPaymentCash', id: 'formOfPayment_1', FormOfPaymentRef: 'formOfPayment_1' },
  });
  const fopErr = fopRes.FormOfPaymentResponse?.Result?.Error?.[0];
  if (fopErr) throw new Error(`Form of payment: ${fopErr.Message}`);
  const fopId = fopRes.FormOfPaymentResponse?.FormOfPayment?.Identifier?.value;

  const payRes = await tvptAirFetch(`/paymentoffer/reservationworkbench/${wb}/payments`, {
    Payment: {
      '@type': 'Payment',
      Amount:  { code: currency, value: amount },
      FormOfPaymentIdentifier: {
        id: 'formOfPayment_1', FormOfPaymentRef: 'formOfPayment_1',
        ...(fopId ? { Identifier: { authority: 'Travelport', value: fopId } } : {}),
      },
      OfferIdentifier: [{ id: 'offer_1', offerRef: 'offer_1', Identifier: { authority: 'Travelport', value: offerId } }],
    },
  });
  const payErr = payRes.PaymentResponse?.Result?.Error?.[0];
  if (payErr) throw new Error(`Payment: ${payErr.Message}`);

  const res = await tvptAirFetch(`/book/reservation/reservations/${wb}`);
  const reservation = res.ReservationResponse?.Reservation ?? {};
  const docs = (reservation.Receipt ?? []).flatMap(r => r.Document ?? []).filter(d => d.Number);
  if (docs.length === 0) {
    const msg = res.ReservationResponse?.Result?.Error?.[0]?.Message;
    throw new Error(msg ? `Ticketing: ${msg}` : 'No ticket number returned');
  }
  return { reservation, docs };
}

// Verify Stripe payment, create the booking, issue e-tickets, email the ticket.
// Any failure after payment refunds the customer automatically.
async function handleTravelportFlightConfirm(event) {
  const secretKey = tvptStripeKey();
  if (!secretKey) return json(500, { error: 'Stripe is not configured' });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { sessionId } = body;
  if (!sessionId) return json(400, { error: 'sessionId is required' });

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return json(400, { error: 'Invalid session ID' });
  }

  if (session.payment_status !== 'paid')              return json(402, { error: 'Payment not completed' });
  if (session.metadata?.type !== 'travelport_flight') return json(400, { error: 'Not a Travelport flight session' });

  const orderId = session.metadata?.flightOrderId;
  if (!orderId || !ObjectId.isValid(orderId)) return json(400, { error: 'Invalid order ID' });

  const db   = await getDb();
  const coll = db.collection('flight_bookings');
  const ticketView = o => ({
    success:        true,
    orderId,
    pnr:            o.pnr,
    airlineLocator: o.airlineLocator ?? null,
    bookingRef:     o.tvptBookingRef,
    tickets:        o.tickets ?? [],
    itinerary:      o.itinerary ?? [],
    passengers:     (o.passengers ?? []).map(p => ({ title: p.title, givenName: p.givenName, familyName: p.familyName, email: p.email })),
    totalPrice:     o.markedUpPrice,
    currency:       o.currency,
    issuedAt:       o.ticketedAt ?? o.confirmedAt,
    testBooking:    !TVPT_LIVE,
  });

  // Claim the order atomically so two confirm calls can never book twice
  const order = await coll.findOneAndUpdate(
    { _id: new ObjectId(orderId), status: 'pending_stripe' },
    { $set: { status: 'processing', stripePaymentIntent: session.payment_intent, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  if (!order) {
    const existing = await coll.findOne({ _id: new ObjectId(orderId) });
    if (!existing) return json(404, { error: 'Order not found' });
    if (existing.status === 'ticketed') return json(200, ticketView(existing));
    if (existing.status === 'processing') return json(202, { pending: true, message: 'Your ticket is being issued. Please refresh in a moment.' });
    return json(500, { error: `This booking could not be completed and your payment has been refunded. Order ID: ${orderId}` });
  }

  const fail = async (stage, err) => {
    console.error(`Flight booking failed at ${stage}:`, err.message);
    let refunded = false;
    try {
      await stripe.refunds.create({ payment_intent: session.payment_intent, metadata: { flightOrderId: orderId } });
      refunded = true;
    } catch (e) {
      console.error('Refund failed:', e.message);
    }
    await coll.updateOne({ _id: order._id }, { $set: {
      status: refunded ? 'refunded' : 'booking_failed', bookingError: `${stage}: ${err.message}`, updatedAt: new Date().toISOString(),
    } });
    return json(500, {
      error: refunded
        ? `We couldn't issue this ticket (${err.message}). Your payment has been refunded in full. Order ID: ${orderId}`
        : `We couldn't issue this ticket and the automatic refund failed. Contact support@lyrtrip.com with order ID: ${orderId}`,
    });
  };

  const { workbenchId } = order;

  // Step 3 — add traveler details to the workbench (one Traveler per call)
  try {
    for (const p of order.passengers) {
      const digits = (p.phone ?? '').replace(/[^\d+]/g, '');
      const intl   = digits.match(/^\+(\d{1,3})(\d{6,})$/);
      await tvptAirFetch(`/book/traveler/reservationworkbench/${workbenchId}/travelers`, {
        Traveler: {
          '@type':           'Traveler',
          passengerTypeCode: 'ADT',
          birthDate:         p.dob,
          gender:            String(p.gender).toLowerCase().startsWith('m') ? 'Male' : 'Female',
          PersonName:        { '@type': 'PersonNameDetail', Given: p.givenName.trim(), Surname: p.familyName.trim() },
          Email:             [{ value: p.email.trim() }],
          ...(digits ? { Telephone: [{
            '@type':           'Telephone',
            countryAccessCode: intl ? intl[1] : '1',
            phoneNumber:       intl ? intl[2] : digits.replace(/^\+/, ''),
            role:              'Home',
          }] } : {}),
        },
      });
    }
  } catch (err) {
    return fail('travelers', err);
  }

  // Step 4 — commit the workbench to create the (held) reservation
  let reservation;
  try {
    reservation = (await tvptAirFetch(`/book/reservation/reservations/${workbenchId}`)).ReservationResponse?.Reservation ?? {};
  } catch (err) {
    return fail('booking', err);
  }
  const locators       = (reservation.Receipt ?? []).map(r => r.Confirmation?.Locator).filter(Boolean);
  const pnr            = locators.find(l => l.source === '1G')?.value ?? locators[0]?.value;
  const airlineLocator = locators.find(l => l.source && l.source !== '1G')?.value ?? null;
  const offerId        = reservation.Offer?.[0]?.Identifier?.value;
  if (!pnr || !offerId) return fail('booking', new Error('no booking reference returned'));
  const bookingRef     = reservation.Receipt?.find(r => r.Confirmation?.Locator)?.Identifier?.value ?? pnr;
  const itinerary      = tvptItinerary(reservation);

  await coll.updateOne({ _id: order._id }, { $set: {
    pnr, airlineLocator, tvptBookingRef: bookingRef, itinerary, confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } });

  // Step 5 — issue the e-tickets
  let issued;
  try {
    issued = await tvptIssueTickets({
      locator:  pnr,
      offerId,
      amount:   order.supplierTotal ?? reservation.Offer?.[0]?.Price?.TotalPrice,
      currency: order.currency,
    });
  } catch (err) {
    return fail(`ticketing (PNR ${pnr})`, err);
  }

  // Match each ticket to its traveler (tickets reference travelers by identifier)
  const travelers = issued.reservation.Traveler ?? reservation.Traveler ?? [];
  const tickets = issued.docs.map((d, i) => {
    const t = travelers.find(tr => tr.Identifier?.value === d.TravelerIdentifierRef?.value) ?? travelers[i];
    const name = t?.PersonName ? `${t.PersonName.Given} ${t.PersonName.Surname}` : `${order.passengers[i]?.givenName ?? ''} ${order.passengers[i]?.familyName ?? ''}`.trim();
    return { number: d.Number, passenger: name, amount: d.Amount?.Total ?? null };
  });

  const ticketedAt = new Date().toISOString();
  await coll.updateOne({ _id: order._id }, { $set: { status: 'ticketed', tickets, ticketedAt, updatedAt: ticketedAt } });
  const done = { ...order, pnr, airlineLocator, tvptBookingRef: bookingRef, itinerary, tickets, ticketedAt };

  // Email the e-ticket
  const sesFrom  = process.env.SES_FROM_EMAIL;
  const paxEmail = order.passengers?.[0]?.email;
  if (sesFrom && paxEmail) {
    try {
      const ses  = new SESClient({});
      const html = generateTicketEmail({
        pnr,
        airlineLocator,
        tickets,
        passengers:    order.passengers,
        flightSummary: { legs: itinerary.map(s => ({
          airline:      s.carrier,
          flightNumber: s.flightNumber,
          travelClass:  s.cabin,
          departure:    { airport: s.from, time: `${s.departureDate} ${s.departureTime}` },
          arrival:      { airport: s.to,   time: `${s.arrivalDate} ${s.arrivalTime}` },
        })) },
        duffelOrderId: bookingRef,
        totalPrice:    order.markedUpPrice,
        currency:      order.currency,
      });
      await ses.send(new SendEmailCommand({
        Source:      sesFrom,
        Destination: { ToAddresses: [paxEmail] },
        Message: {
          Subject: { Data: `Your Lyrtrip E-Ticket — ${pnr}` },
          Body: {
            Html: { Data: html },
            Text: { Data: `Ticket issued. Booking reference: ${pnr}. E-ticket: ${tickets.map(t => `${t.passenger} ${t.number}`).join(', ')}` },
          },
        },
      }));
    } catch (emailErr) {
      console.error('SES email failed:', emailErr);
    }
  }

  return json(200, ticketView(done));
}

// Stripe checkout for a Travelport hotel room (prepaid model).
// The guest pays Lyrtrip through Stripe; after payment Lyrtrip pays the hotel with a
// single-use Stripe Issuing virtual card (see handleTravelportHotelConfirm).
async function handleTravelportHotelCheckout(event) {
  const secretKey = tvptStripeKey();
  if (!secretKey)                         return json(500, { error: 'Stripe is not configured' });
  if (!process.env.TRAVELPORT_CLIENT_ID) return json(500, { error: 'Travelport is not configured' });
  const modeError = tvptPaymentModeError();
  if (modeError) return json(503, { error: modeError });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { chainCode, propertyCode, bookingCode, checkin, checkout, guests = 1, guest = {}, hotelName } = body;

  if (!chainCode || !propertyCode || !bookingCode || !checkin || !checkout) {
    return json(400, { error: 'chainCode, propertyCode, bookingCode, checkin and checkout are required' });
  }
  if (!guest.givenName?.trim() || !guest.familyName?.trim() || !guest.email?.trim()) {
    return json(400, { error: 'Guest first name, last name and email are required' });
  }

  // Price on the server from a fresh availability call; this is the amount we charge
  let room;
  try {
    const rooms = await tvptHotelRooms({ chainCode, propertyCode, checkin, checkout, guests });
    room = rooms.find(r => r.bookingCode === bookingCode);
  } catch (err) {
    return json(err.status ?? 500, { error: `Could not confirm room price: ${err.message}` });
  }
  if (!room) return json(409, { error: 'That room is no longer available. Please choose another room.' });

  const db  = await getDb();
  const now = new Date().toISOString();
  const result = await db.collection('hotel_bookings').insertOne({
    status:        'pending_stripe',
    provider:      'travelport',
    chainCode,
    propertyCode,
    bookingCode,
    roomName:      room.name,
    cancelPolicy:  room.cancelPolicy,
    refundable:    room.refundable,
    checkin,
    checkout,
    nights:        room.nights,
    guests:        Number(guests) || 1,
    guest:         {
      givenName:  guest.givenName.trim(),
      familyName: guest.familyName.trim(),
      email:      guest.email.trim(),
      phone:      guest.phone?.trim() ?? '',
    },
    guestName:     `${guest.givenName.trim()} ${guest.familyName.trim()}`,
    guestEmail:    guest.email.trim(),
    hotelName:     hotelName ?? `${chainCode} ${propertyCode}`,
    supplierTotal: room.supplierTotal,
    taxes:         room.taxes,
    markedUpPrice: room.total,
    currency:      room.currency,
    createdAt:     now,
    updatedAt:     now,
  });
  const orderId = result.insertedId.toString();

  const stripe  = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  const session = await stripe.checkout.sessions.create({
    mode:                 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:    room.currency.toLowerCase(),
        unit_amount: Math.round(room.total * 100),
        product_data: {
          name:        `${TVPT_LIVE ? '' : '[TEST] '}${hotelName ?? 'Hotel'} — ${room.name}`.slice(0, 250),
          description: `${room.nights} night${room.nights !== 1 ? 's' : ''} · ${checkin} → ${checkout} · taxes & Lyrtrip fee included · ${room.refundable ? 'refundable' : 'non-refundable'}`,
        },
      },
      quantity: 1,
    }],
    metadata:       { type: 'travelport_hotel', hotelOrderId: orderId },
    customer_email: guest.email.trim(),
    success_url:    `${SITE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&type=travelport_hotel`,
    cancel_url:     `${SITE_URL}/booking/cancel`,
  });

  await db.collection('hotel_bookings').updateOne(
    { _id: result.insertedId },
    { $set: { stripeSessionId: session.id, updatedAt: new Date().toISOString() } }
  );

  return json(200, { url: session.url, orderId });
}

// Travelport card-type codes for Stripe card brands
const TVPT_CARD_CODE = { visa: 'VI', mastercard: 'CA', amex: 'AX', 'american express': 'AX', discover: 'DS' };

// Single-use virtual card, capped at the hotel's price, used to pay the hotel through Travelport
async function issueHotelPaymentCard(stripe, { amount, currency, orderId }) {
  const cardholder = process.env.STRIPE_ISSUING_CARDHOLDER_ID;
  if (!cardholder) throw new Error('STRIPE_ISSUING_CARDHOLDER_ID is not configured');
  const card = await stripe.issuing.cards.create({
    cardholder,
    currency: currency.toLowerCase(),
    type:     'virtual',
    status:   'active',
    // 2% headroom for FX/rounding at the hotel; nothing beyond this can be charged
    spending_controls: { spending_limits: [{ amount: Math.ceil(amount * 100 * 1.02), interval: 'all_time' }] },
    metadata: { hotelOrderId: orderId },
  });
  const full = await stripe.issuing.cards.retrieve(card.id, { expand: ['number', 'cvc'] });
  return full;
}

// Verify Stripe payment, pay the hotel with a virtual card, and create the Travelport reservation.
// Any failure after payment refunds the guest and cancels the card.
async function handleTravelportHotelConfirm(event) {
  const secretKey = tvptStripeKey();
  if (!secretKey) return json(500, { error: 'Stripe is not configured' });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { sessionId } = body;
  if (!sessionId) return json(400, { error: 'sessionId is required' });

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return json(400, { error: 'Invalid session ID' });
  }

  if (session.payment_status !== 'paid')            return json(402, { error: 'Payment not completed' });
  if (session.metadata?.type !== 'travelport_hotel') return json(400, { error: 'Not a hotel session' });

  const orderId = session.metadata?.hotelOrderId;
  if (!orderId || !ObjectId.isValid(orderId)) return json(400, { error: 'Invalid order ID' });

  const db   = await getDb();
  const coll = db.collection('hotel_bookings');
  const summary = o => ({
    orderId,
    hotelName:  o.hotelName,
    roomName:   o.roomName,
    checkin:    o.checkin,
    checkout:   o.checkout,
    nights:     o.nights,
    totalPrice: o.markedUpPrice,
    currency:   o.currency,
    testBooking: !TVPT_LIVE,
  });

  // Claim the order atomically so two confirm calls can never book twice
  const order = await coll.findOneAndUpdate(
    { _id: new ObjectId(orderId), status: 'pending_stripe' },
    { $set: { status: 'processing', stripePaymentIntent: session.payment_intent, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  if (!order) {
    const existing = await coll.findOne({ _id: new ObjectId(orderId) });
    if (!existing) return json(404, { error: 'Order not found' });
    if (existing.status === 'confirmed') {
      return json(200, { success: true, bookingRef: existing.tvptBookingRef, hotelConfirmation: existing.hotelConfirmation, ...summary(existing) });
    }
    if (existing.status === 'processing') return json(202, { pending: true, message: 'Your booking is being confirmed. Please refresh in a moment.' });
    return json(500, { error: `This booking could not be completed and your payment has been refunded. Order ID: ${orderId}` });
  }

  const fail = async (stage, err, card) => {
    console.error(`Hotel booking failed at ${stage}:`, err.message);
    if (card) await stripe.issuing.cards.update(card.id, { status: 'canceled' }).catch(e => console.error('Card cancel failed:', e.message));
    let refunded = false;
    try {
      await stripe.refunds.create({ payment_intent: session.payment_intent, metadata: { hotelOrderId: orderId } });
      refunded = true;
    } catch (e) {
      console.error('Refund failed:', e.message);
    }
    await coll.updateOne({ _id: order._id }, { $set: {
      status: refunded ? 'refunded' : 'booking_failed', bookingError: `${stage}: ${err.message}`, updatedAt: new Date().toISOString(),
    } });
    return json(500, {
      error: refunded
        ? `We couldn't reserve this room (${err.message}). Your payment has been refunded in full. Order ID: ${orderId}`
        : `We couldn't reserve this room and the automatic refund failed. Contact support@lyrtrip.com with order ID: ${orderId}`,
    });
  };

  // Re-check the room: offer IDs expire, so match on the room's booking code and hold the price
  let room;
  try {
    const rooms = await tvptHotelRooms({
      chainCode: order.chainCode, propertyCode: order.propertyCode,
      checkin: order.checkin, checkout: order.checkout, guests: order.guests,
    });
    room = rooms.find(r => r.bookingCode === order.bookingCode);
  } catch (err) {
    return fail('availability', err);
  }
  if (!room) return fail('availability', new Error('room no longer available'));
  if (room.supplierTotal > order.supplierTotal * 1.01) {
    return fail('availability', new Error(`hotel price rose from ${order.supplierTotal} to ${room.supplierTotal}`));
  }

  let card;
  try {
    card = await issueHotelPaymentCard(stripe, { amount: room.supplierTotal, currency: room.currency, orderId });
  } catch (err) {
    return fail('virtual card', err);
  }

  let reservationRes;
  try {
    reservationRes = await tvptHotelFetch('/book/reservations/build', {
      ReservationQueryBuild: {
        '@type': 'ReservationQueryBuild',
        ReservationBuild: {
          '@type': 'ReservationBuildFromCatalogOffering',
          BuildFromCatalogOfferingHospitality: {
            '@type': 'BuildFromCatalogOfferingHospitality',
            CatalogOfferingIdentifier: { value: room.offerId },
          },
          Traveler: [{
            '@type':    'Traveler',
            PersonName: { Given: order.guest.givenName, Surname: order.guest.familyName },
            Email:      [{ value: order.guest.email }],
            ...(order.guest.phone ? { Telephone: [{ '@type': 'TelephoneDetail', phoneNumber: order.guest.phone.replace(/[^\d]/g, '') }] } : {}),
          }],
          FormOfPayment: [{
            '@type': 'FormOfPaymentPaymentCard',
            PaymentCard: {
              '@type':        'PaymentCardDetail',
              expireDate:     `${String(card.exp_month).padStart(2, '0')}${String(card.exp_year).slice(-2)}`,
              CardType:       'Credit',
              CardCode:       TVPT_CARD_CODE[card.brand?.toLowerCase()] ?? 'VI',
              CardHolderName: card.cardholder?.name ?? 'Lyrtrip',
              CardNumber:     { '@type': 'CardNumber', PlainText: card.number },
              SeriesCode:     { '@type': 'SeriesCode', PlainText: card.cvc },
            },
          }],
          Payment: [{
            '@type':      'Payment',
            Amount:       { code: room.currency, value: room.supplierTotal },
            guaranteeInd: room.guaranteeType !== 'DepositRequired',
            depositInd:   room.guaranteeType === 'DepositRequired',
          }],
        },
      },
    });
  } catch (err) {
    return fail('reservation', err, card);
  }

  const reservation = reservationRes.ReservationResponse?.Reservation ?? {};
  const locators    = (reservation.Receipt ?? []).map(r => r.Confirmation?.Locator).filter(Boolean);
  const pnr         = locators.find(l => l.sourceContext === 'Travelport')?.value;
  const hotelConf   = locators.find(l => l.sourceContext === 'Supplier')?.value;
  if (!pnr && !hotelConf) return fail('reservation', new Error('no confirmation number returned'), card);

  const bookingRef = pnr ?? hotelConf;
  await coll.updateOne(
    { _id: order._id },
    { $set: {
      status: 'confirmed', tvptBookingRef: bookingRef, hotelConfirmation: hotelConf ?? null,
      issuingCardId: card.id, supplierTotal: room.supplierTotal,
      confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } }
  );

  const sesFrom = process.env.SES_FROM_EMAIL;
  if (sesFrom && order.guestEmail) {
    try {
      const ses = new SESClient({});
      await ses.send(new SendEmailCommand({
        Source:      sesFrom,
        Destination: { ToAddresses: [order.guestEmail] },
        Message: {
          Subject: { Data: `Hotel Confirmed — ${order.hotelName}` },
          Body: {
            Text: {
              Data: [
                `Hotel booking confirmed!`,
                ``,
                `Property : ${order.hotelName}`,
                `Room     : ${order.roomName}`,
                `Check-in : ${order.checkin}`,
                `Check-out: ${order.checkout}`,
                `Nights   : ${order.nights}`,
                `Hotel confirmation: ${hotelConf ?? '—'}`,
                `Booking reference : ${bookingRef}`,
                ``,
                `Total paid: ${order.currency} ${order.markedUpPrice.toFixed(2)} (prepaid — nothing to pay at the hotel)`,
                `Cancellation: ${order.cancelPolicy || 'see hotel policy'}`,
                ``,
                `Questions? support@lyrtrip.com`,
              ].join('\n'),
            },
          },
        },
      }));
    } catch (emailErr) {
      console.error('Hotel confirmation email failed:', emailErr);
    }
  }

  return json(200, { success: true, bookingRef, hotelConfirmation: hotelConf ?? null, ...summary(order) });
}

// ---------------------------------------------------------------------------
// MongoDB / Cognito helpers (unchanged)
// ---------------------------------------------------------------------------

let mongoClientPromise;
let verifier;

function getMongoClient() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  if (!mongoClientPromise) {
    // Fail well inside API Gateway's 30s limit, and don't cache a failed connection
    const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    mongoClientPromise = client.connect().catch(err => {
      mongoClientPromise = null;
      throw new Error(`Database unavailable: ${err.message}`);
    });
  }
  return mongoClientPromise;
}

async function getDb() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB_NAME || 'lyrtrip');
}

function getVerifier() {
  if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_USER_POOL_CLIENT_ID) {
    throw new Error('Cognito JWT verification is not configured.');
  }
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      tokenUse: 'access',
      clientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
    });
  }
  return verifier;
}

async function getAuthenticatedUser(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
  if (!token) return null;
  return getVerifier().verify(token);
}

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'OPTIONS,GET,POST',
    'access-control-allow-headers': 'authorization,content-type',
  },
  body: JSON.stringify(body),
});

let cognitoClient;

function getCognitoClient() {
  if (!cognitoClient) cognitoClient = new CognitoIdentityProviderClient({});
  return cognitoClient;
}

function getWeChatConfig() {
  const appId        = process.env.WECHAT_APP_ID;
  const appSecret    = process.env.WECHAT_APP_SECRET;
  const sharedSecret = process.env.WECHAT_AUTH_SHARED_SECRET;
  const userPoolId   = process.env.COGNITO_USER_POOL_ID;
  const clientId     = process.env.COGNITO_USER_POOL_CLIENT_ID;

  if (!appId || !appSecret || !sharedSecret || !userPoolId || !clientId) {
    throw new Error('WeChat sign-in is not fully configured.');
  }

  return { appId, appSecret, sharedSecret, userPoolId, clientId };
}

function challengeAnswerFor(openid, sharedSecret) {
  return createHmac('sha256', sharedSecret).update(openid).digest('hex');
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleWeChatAuth(event) {
  let config;
  try {
    config = getWeChatConfig();
  } catch (error) {
    return json(500, { error: error.message });
  }

  const body = JSON.parse(event.body || '{}');
  const { code } = body;

  if (!code) return json(400, { error: 'Missing WeChat authorization code.' });

  const tokenResponse = await fetch(
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${config.appId}&secret=${config.appSecret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`
  );
  const tokenBody = await tokenResponse.json();

  if (!tokenBody.access_token || !tokenBody.openid) {
    return json(400, { error: tokenBody.errmsg || 'WeChat code exchange failed.' });
  }

  const { access_token: wechatAccessToken, openid } = tokenBody;

  const profileResponse = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?access_token=${wechatAccessToken}&openid=${openid}&lang=en`
  );
  const profileBody = await profileResponse.json();
  const nickname = profileBody.nickname || undefined;
  const avatar   = profileBody.headimgurl || undefined;

  const cognito  = getCognitoClient();
  const username = `wechat_${openid}`;

  try {
    await cognito.send(new AdminGetUserCommand({ UserPoolId: config.userPoolId, Username: username }));
  } catch (error) {
    if (error.name !== 'UserNotFoundException') {
      console.error('AdminGetUser error:', error);
      return json(500, { error: 'Failed to look up WeChat user.' });
    }

    await cognito.send(new AdminCreateUserCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email_verified', Value: 'false' },
        { Name: 'custom:wechat_openid', Value: openid },
        ...(nickname ? [{ Name: 'name',    Value: nickname }] : []),
        ...(avatar   ? [{ Name: 'picture', Value: avatar   }] : []),
      ],
    }));
  }

  if (nickname || avatar) {
    await cognito.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: config.userPoolId,
      Username: username,
      UserAttributes: [
        ...(nickname ? [{ Name: 'name',    Value: nickname }] : []),
        ...(avatar   ? [{ Name: 'picture', Value: avatar   }] : []),
      ],
    })).catch(error => console.error('AdminUpdateUserAttributes error:', error));
  }

  const initiateResponse = await cognito.send(new AdminInitiateAuthCommand({
    UserPoolId: config.userPoolId,
    ClientId: config.clientId,
    AuthFlow: 'CUSTOM_AUTH',
    AuthParameters: { USERNAME: username },
    ClientMetadata: { openid },
  }));

  if (!initiateResponse.ChallengeName || !initiateResponse.Session) {
    console.error('Unexpected AdminInitiateAuth response for WeChat bridge.');
    return json(500, { error: 'WeChat sign-in is not fully configured.' });
  }

  const challengeResponse = await cognito.send(new AdminRespondToAuthChallengeCommand({
    UserPoolId: config.userPoolId,
    ClientId: config.clientId,
    ChallengeName: initiateResponse.ChallengeName,
    Session: initiateResponse.Session,
    ChallengeResponses: {
      USERNAME: username,
      ANSWER: challengeAnswerFor(openid, config.sharedSecret),
    },
  }));

  const result = challengeResponse.AuthenticationResult;

  if (!result?.AccessToken) {
    return json(401, { error: 'WeChat sign-in could not be completed.' });
  }

  return json(200, {
    success: true,
    tokens: {
      accessToken:  result.AccessToken,
      idToken:      result.IdToken,
      refreshToken: result.RefreshToken,
      expiresIn:    result.ExpiresIn,
    },
    profile: { nickname, avatar },
  });
}

async function searchHotelsSerpApi({ destination, checkin, checkout, guests }) {
  const params = new URLSearchParams({
    engine:   'google_hotels',
    q:        destination ? `Hotels in ${destination}` : 'Hotels',
    currency: 'USD',
    gl:       'us',
    hl:       'en',
    adults:   String(guests || 1),
    api_key:  process.env.SERPAPI_KEY,
  });
  if (checkin)  params.set('check_in_date',  checkin);
  if (checkout) params.set('check_out_date', checkout);

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SerpAPI error (${res.status}): ${err}`);
  }
  const data = await res.json();

  return (data.properties ?? []).map((p, i) => ({
    id:           p.property_token ?? String(i),
    name:         p.name ?? 'Hotel',
    description:  p.description ?? p.neighborhood ?? '',
    rating:       p.overall_rating,
    reviewCount:  p.reviews,
    hotelClass:   p.hotel_class,
    amenities:    p.amenities ?? [],
    price:        p.rate_per_night?.extracted_lowest,
    pricePerNight: p.rate_per_night?.extracted_lowest,
    unit:         '/night',
    currency:     'USD',
    imageUrl:     p.images?.[0]?.thumbnail,
    link:         p.link,
    checkIn:      p.check_in_time,
    checkOut:     p.check_out_time,
  }));
}

// ---------------------------------------------------------------------------
// Duffel flight API integration
// ---------------------------------------------------------------------------

const FLIGHT_MARKUP = 1.08; // 8% profit margin on base ticket price

async function duffelFetch(path, { method = 'GET', body } = {}) {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) throw new Error('Duffel not configured');
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Duffel-Version': 'v2',
    'Accept': 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`https://api.duffel.com${path}`, { method, headers, body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Duffel (${res.status}) ${path}: ${err}`);
  }
  return res.json();
}

function parseDuffelDuration(iso) {
  // "PT14H30M" → minutes
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? (parseInt(m[1] || '0') * 60) + parseInt(m[2] || '0') : 0;
}

async function searchFlightsDuffel({ from, to, depart, returnDate, passengers = 1 }) {
  const fromIata = resolveIata(from);
  const toIata   = resolveIata(to);

  const slices = [{ origin: fromIata, destination: toIata, departure_date: depart }];
  if (returnDate) slices.push({ origin: toIata, destination: fromIata, departure_date: returnDate });

  const passengerList = Array.from({ length: passengers }, () => ({ type: 'adult' }));

  // Step 1: create offer request
  const reqData = await duffelFetch('/air/offer_requests', {
    method: 'POST',
    body: JSON.stringify({ data: { slices, passengers: passengerList, cabin_class: 'economy' } }),
  });

  const offerRequestId = reqData.data?.id;
  if (!offerRequestId) throw new Error('No offer_request_id from Duffel');

  // Step 2: fetch offers
  const offersData = await duffelFetch(
    `/air/offers?offer_request_id=${offerRequestId}&sort=total_amount&limit=20`
  );

  const offers = offersData.data ?? [];

  return offers.map((offer, i) => {
    const slice      = offer.slices?.[0];
    const segments   = slice?.segments ?? [];
    const firstSeg   = segments[0];
    const lastSeg    = segments[segments.length - 1];
    const baseTotal  = parseFloat(offer.total_amount || '0');
    const markedUp   = Math.ceil(baseTotal * FLIGHT_MARKUP * 100) / 100;
    const pricePerPerson = Math.ceil(markedUp / passengers * 100) / 100;

    const legs = segments.map(seg => ({
      airline:      seg.marketing_carrier?.name ?? seg.operating_carrier?.name ?? 'Unknown',
      airlineLogo:  seg.marketing_carrier?.logo_symbol_url ?? null,
      flightNumber: `${seg.marketing_carrier?.iata_code ?? ''}${seg.marketing_carrier_flight_number ?? ''}`,
      departure: {
        airport: seg.origin?.iata_code ?? '',
        name:    seg.origin?.name ?? '',
        time:    seg.departing_at ?? '',
      },
      arrival: {
        airport: seg.destination?.iata_code ?? '',
        name:    seg.destination?.name ?? '',
        time:    seg.arriving_at ?? '',
      },
      duration:    parseDuffelDuration(seg.duration),
      airplane:    seg.aircraft?.name ?? '',
      travelClass: offer.cabin_class ?? 'economy',
      legroom:     null,
      extensions:  [],
    }));

    const layovers = segments.slice(0, -1).map((seg, idx) => {
      const next = segments[idx + 1];
      if (!next) return null;
      const layoverMins = Math.round(
        (new Date(next.departing_at) - new Date(seg.arriving_at)) / 60000
      );
      return {
        name:      seg.destination?.name ?? '',
        id:        seg.destination?.iata_code ?? '',
        duration:  layoverMins,
        overnight: false,
      };
    }).filter(Boolean);

    return {
      id:                   `duffel-${i}`,
      type:                 'flight',
      duffelOfferId:        offer.id,
      duffelPassengerIds:   offer.passengers?.map(p => p.id) ?? [],
      duffelPassengerCount: passengers,
      duffelExpiresAt:      offer.expires_at,
      isBest:               i < 3,
      price:                pricePerPerson,
      totalPrice:           markedUp,
      basePrice:            baseTotal,
      totalDuration:        parseDuffelDuration(slice?.duration),
      airlineLogo:          firstSeg?.marketing_carrier?.logo_symbol_url ?? null,
      legs,
      layovers,
      extensions:           [],
      carbonEmissions:      null,
      name:                 firstSeg?.marketing_carrier?.name ?? 'Flight',
      description:          `${fromIata} → ${toIata}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Flight e-ticket email template
// ---------------------------------------------------------------------------

function generateTicketEmail({ pnr, airlineLocator = null, tickets = [], passengers, flightSummary, duffelOrderId, totalPrice, currency }) {
  const paxNames = passengers.map(p => `${p.givenName} ${p.familyName}`).join(', ');

  const legsHtml = (flightSummary?.legs ?? []).map(leg => {
    const fmtDt = dt => dt ? dt.replace('T', ' ').slice(0, 16) : '';
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-radius:10px;margin-bottom:12px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;width:33%;vertical-align:top;">
          <p style="margin:0;font-weight:900;font-size:28px;color:#1e1b4b;letter-spacing:1px">${leg.departure?.airport ?? ''}</p>
          <p style="margin:4px 0 0;color:#4f46e5;font-size:13px;font-weight:600">${fmtDt(leg.departure?.time)}</p>
          <p style="margin:3px 0 0;color:#6b7280;font-size:11px">${leg.departure?.name ?? ''}</p>
        </td>
        <td style="padding:16px 10px;width:34%;text-align:center;vertical-align:middle;">
          <p style="margin:0;font-size:11px;color:#6b7280;font-weight:600">${leg.airline ?? ''}</p>
          <p style="margin:4px 0;font-size:11px;color:#9ca3af">${leg.flightNumber ?? ''}</p>
          <p style="margin:0;font-size:22px;color:#4f46e5">&#9992;</p>
          <div style="height:2px;background:linear-gradient(to right,#4f46e5,#7c3aed);border-radius:2px;margin:4px 0;"></div>
          <p style="margin:4px 0 0;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">${leg.travelClass ?? 'Economy'}</p>
        </td>
        <td style="padding:16px 20px;width:33%;vertical-align:top;text-align:right;">
          <p style="margin:0;font-weight:900;font-size:28px;color:#1e1b4b;letter-spacing:1px">${leg.arrival?.airport ?? ''}</p>
          <p style="margin:4px 0 0;color:#4f46e5;font-size:13px;font-weight:600">${fmtDt(leg.arrival?.time)}</p>
          <p style="margin:3px 0 0;color:#6b7280;font-size:11px">${leg.arrival?.name ?? ''}</p>
        </td>
      </tr>
    </table>`;
  }).join('');

  const paxRows = passengers.map((p, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'}">
      <td style="padding:10px 16px;color:#374151;font-size:13px">${p.givenName} ${p.familyName}</td>
      <td style="padding:10px 16px;color:#6b7280;font-size:13px">${p.email ?? ''}</td>
      <td style="padding:10px 16px;color:#6b7280;font-size:13px;text-align:center">${(p.nationality ?? '').toUpperCase()}</td>
      <td style="padding:10px 16px;color:#1e1b4b;font-size:13px;font-family:monospace;font-weight:700">${tickets[i]?.number ?? '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Lyrtrip Flight Ticket</title>
</head>
<body style="margin:0;padding:0;background:#e8eaf6;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#e8eaf6;padding:24px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(79,70,229,0.12);">

  <!-- ── HEADER: Logos ─────────────────────────────────────────────── -->
  <tr>
    <td style="background:white;padding:20px 28px 16px;border-bottom:1px solid #e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <img src="https://www.lyrtrip.com/logo.png" alt="Lyrtrip" height="40"
                 style="height:40px;width:auto;display:block;"
                 onerror="this.style.display='none'" />
          </td>
          <td style="vertical-align:middle;text-align:right;">
            <!-- IATA Accredited Agent Badge -->
            <table cellpadding="0" cellspacing="0" style="display:inline-table;border:2px solid #003366;border-radius:6px;overflow:hidden;">
              <tr>
                <td style="background:#003366;padding:6px 10px;text-align:center;">
                  <p style="margin:0;color:#ffffff;font-size:15px;font-weight:900;letter-spacing:3px;line-height:1">IATA</p>
                </td>
                <td style="background:#f0f4ff;padding:5px 10px;text-align:center;">
                  <p style="margin:0;color:#003366;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;line-height:1.3">Accredited<br>Agent</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── HERO BANNER ────────────────────────────────────────────────── -->
  <tr>
    <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);padding:32px 28px;text-align:center;">
      <p style="margin:0 0 6px;font-size:36px">&#10003;</p>
      <h1 style="margin:0;color:white;font-size:24px;font-weight:800;letter-spacing:-0.5px">Flight Ticket Confirmed</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px">Booking Reference: <strong style="color:white">${duffelOrderId}</strong></p>
    </td>
  </tr>

  <!-- ── PNR ────────────────────────────────────────────────────────── -->
  <tr>
    <td style="padding:28px;text-align:center;border-bottom:2px dashed #e5e7eb;">
      <p style="margin:0 0 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:3px">PNR / Check-In Code</p>
      <p style="margin:0;font-size:46px;font-weight:900;color:#4f46e5;letter-spacing:10px;line-height:1">${pnr}</p>
      <p style="margin:10px 0 0;color:#9ca3af;font-size:12px">Present this code at the check-in counter or use it for online check-in</p>
      ${airlineLocator ? `<p style="margin:8px 0 0;color:#6b7280;font-size:12px">Airline reference: <strong style="color:#1e1b4b;letter-spacing:2px">${airlineLocator}</strong></p>` : ''}
    </td>
  </tr>

  <!-- ── ITINERARY ─────────────────────────────────────────────────── -->
  <tr>
    <td style="padding:24px 28px 8px;">
      <p style="margin:0 0 14px;color:#1e1b4b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">&#9992; Flight Itinerary</p>
      ${legsHtml}
    </td>
  </tr>

  <!-- ── PASSENGERS ────────────────────────────────────────────────── -->
  <tr>
    <td style="padding:8px 28px 24px;">
      <p style="margin:0 0 12px;color:#1e1b4b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">&#128100; Passengers</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background:#f0f4ff;">
          <th style="padding:10px 16px;color:#4f46e5;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:700">Name</th>
          <th style="padding:10px 16px;color:#4f46e5;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:700">Email</th>
          <th style="padding:10px 16px;color:#4f46e5;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:center;font-weight:700">Nat.</th>
          <th style="padding:10px 16px;color:#4f46e5;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;font-weight:700">E-Ticket No.</th>
        </tr>
        ${paxRows}
      </table>
    </td>
  </tr>

  <!-- ── PRICE ─────────────────────────────────────────────────────── -->
  <tr>
    <td style="padding:16px 28px;background:#f0f4ff;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:13px">Total Paid (incl. all taxes &amp; service fees)</td>
          <td style="text-align:right;">
            <strong style="color:#4f46e5;font-size:22px;font-weight:900">${currency} ${totalPrice.toFixed(2)}</strong>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ── IMPORTANT NOTES ───────────────────────────────────────────── -->
  <tr>
    <td style="padding:20px 28px;background:#fffbeb;border-bottom:1px solid #fde68a;">
      <p style="margin:0 0 8px;color:#92400e;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px">&#9888; Important Information</p>
      <ul style="margin:0;padding-left:18px;color:#78350f;font-size:12px;line-height:1.8">
        <li>Arrive at the airport at least 2 hours before departure (international: 3 hours)</li>
        <li>Carry a valid passport or government-issued photo ID</li>
        <li>Online check-in opens 24 hours before departure — use your PNR above</li>
        <li>Baggage allowance depends on your fare class — check with the airline directly</li>
      </ul>
    </td>
  </tr>

  <!-- ── FOOTER ────────────────────────────────────────────────────── -->
  <tr>
    <td style="padding:20px 28px;text-align:center;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="text-align:center;padding-bottom:12px;">
            <img src="https://www.lyrtrip.com/logo.png" alt="Lyrtrip" height="28"
                 style="height:28px;width:auto;opacity:0.6;"
                 onerror="this.style.display='none'" />
          </td>
        </tr>
        <tr>
          <td style="text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.6">
              Booked via <strong style="color:#6b7280">Lyrtrip</strong> &mdash; Your Global Travel Partner
              &bull; <a href="https://www.lyrtrip.com" style="color:#4f46e5;text-decoration:none">www.lyrtrip.com</a>
            </p>
            <p style="margin:6px 0 0;color:#9ca3af;font-size:11px">
              Questions? <a href="mailto:support@lyrtrip.com" style="color:#4f46e5;text-decoration:none">support@lyrtrip.com</a>
            </p>
            <p style="margin:12px 0 0;color:#d1d5db;font-size:10px">
              IATA Accredited Agent &bull; Powered by Duffel &bull; Secured by Stripe
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Flight checkout — stores pending order, creates Stripe session
// ---------------------------------------------------------------------------

async function handleFlightCheckout(event) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: 'Stripe is not configured' });
  if (!process.env.DUFFEL_API_KEY) return json(500, { error: 'Duffel is not configured' });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { duffelOfferId, duffelPassengerIds, passengers, flightSummary } = body;

  if (!duffelOfferId) return json(400, { error: 'duffelOfferId is required' });
  if (!Array.isArray(passengers) || passengers.length === 0) return json(400, { error: 'passengers array is required' });

  // Fetch current offer to verify validity and get live price
  let offer;
  try {
    const offerData = await duffelFetch(`/air/offers/${duffelOfferId}`);
    offer = offerData.data;
  } catch (err) {
    return json(400, { error: `Flight offer no longer available: ${err.message}` });
  }

  if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
    return json(400, { error: 'Flight offer has expired. Please search again.' });
  }

  const numPassengers  = passengers.length;
  const baseTotal      = parseFloat(offer.total_amount || '0');
  const markedUpTotal  = Math.ceil(baseTotal * FLIGHT_MARKUP * 100) / 100;
  const amountCents    = Math.round(markedUpTotal * 100);
  const currency       = offer.total_currency ?? 'USD';

  const slice    = offer.slices?.[0];
  const segs     = slice?.segments ?? [];
  const firstSeg = segs[0];
  const lastSeg  = segs[segs.length - 1];
  const routeName  = firstSeg && lastSeg
    ? `${firstSeg.origin?.iata_code} → ${lastSeg.destination?.iata_code}`
    : 'Flight';
  const airlineName  = firstSeg?.marketing_carrier?.name ?? 'Flight';

  const db  = await getDb();
  const now = new Date().toISOString();

  const pendingDoc = {
    status:              'pending_stripe',
    duffelOfferId,
    duffelPassengerIds:  duffelPassengerIds ?? (offer.passengers?.map(p => p.id) ?? []),
    passengers,
    flightSummary:       flightSummary ?? {},
    basePrice:           baseTotal,
    markedUpPrice:       markedUpTotal,
    currency,
    numPassengers,
    createdAt:           now,
    updatedAt:           now,
  };

  const result       = await db.collection('flight_bookings').insertOne(pendingDoc);
  const flightOrderId = result.insertedId.toString();

  const stripe  = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     currency.toLowerCase(),
        unit_amount:  amountCents,
        product_data: {
          name:        `${airlineName} — ${routeName}`,
          description: `${numPassengers} passenger${numPassengers !== 1 ? 's' : ''} · includes taxes & service fees`,
        },
      },
      quantity: 1,
    }],
    metadata: { type: 'flight', flightOrderId },
    customer_email: passengers[0]?.email || undefined,
    success_url: `https://www.lyrtrip.com/booking/success?session_id={CHECKOUT_SESSION_ID}&type=flight`,
    cancel_url:  'https://www.lyrtrip.com/booking/cancel',
  });

  await db.collection('flight_bookings').updateOne(
    { _id: result.insertedId },
    { $set: { stripeSessionId: session.id, updatedAt: new Date().toISOString() } }
  );

  return json(200, { url: session.url, flightOrderId });
}

// ---------------------------------------------------------------------------
// Flight confirm — verifies payment, creates Duffel order, sends e-ticket
// ---------------------------------------------------------------------------

async function handleFlightConfirm(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { sessionId } = body;
  if (!sessionId) return json(400, { error: 'sessionId is required' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: 'Stripe is not configured' });

  // 1. Verify Stripe payment
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return json(400, { error: 'Invalid session ID' });
  }

  if (session.payment_status !== 'paid') return json(402, { error: 'Payment not completed' });
  if (session.metadata?.type !== 'flight') return json(400, { error: 'Not a flight session' });

  const flightOrderId = session.metadata?.flightOrderId;
  if (!flightOrderId || !ObjectId.isValid(flightOrderId)) return json(400, { error: 'Invalid flight order ID' });

  const db = await getDb();
  const order = await db.collection('flight_bookings').findOne({ _id: new ObjectId(flightOrderId) });
  if (!order) return json(404, { error: 'Flight order not found' });

  // Idempotent — already confirmed
  if (order.status === 'confirmed') {
    return json(200, {
      success: true, pnr: order.pnr, duffelOrderId: order.duffelOrderId,
      flightOrderId, flightSummary: order.flightSummary,
      passengers: order.passengers, totalPrice: order.markedUpPrice, currency: order.currency,
    });
  }

  if (order.status === 'booking_failed') {
    return json(500, { error: `Booking failed. Contact support@lyrtrip.com with order ID: ${flightOrderId}` });
  }

  await db.collection('flight_bookings').updateOne(
    { _id: order._id },
    { $set: { status: 'processing', updatedAt: new Date().toISOString() } }
  );

  // 2. Create Duffel order
  let duffelOrder;
  try {
    const passengerData = order.passengers.map((p, i) => ({
      id:           order.duffelPassengerIds[i],
      title:        p.title,
      given_name:   p.givenName,
      family_name:  p.familyName,
      born_on:      p.dob,
      gender:       p.gender,
      nationality:  p.nationality,
      email:        p.email,
      phone_number: p.phone,
    }));

    const orderRes = await duffelFetch('/air/orders', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type:             'instant',
          selected_offers:  [order.duffelOfferId],
          passengers:       passengerData,
          payments: [{
            type:     'balance',
            amount:   order.basePrice.toFixed(2),
            currency: order.currency,
          }],
        },
      }),
    });
    duffelOrder = orderRes.data;
  } catch (err) {
    console.error('Duffel order failed:', err);
    await db.collection('flight_bookings').updateOne(
      { _id: order._id },
      { $set: { status: 'booking_failed', bookingError: err.message, updatedAt: new Date().toISOString() } }
    );
    return json(500, {
      error: `Ticket issuance failed: ${err.message}. Your payment was collected — contact support@lyrtrip.com with order ID: ${flightOrderId}`,
    });
  }

  const pnr           = duffelOrder.booking_reference;
  const ticketNumbers = (duffelOrder.documents ?? []).map(d => d.unique_identifier).filter(Boolean);

  await db.collection('flight_bookings').updateOne(
    { _id: order._id },
    { $set: {
      status:        'confirmed',
      duffelOrderId: duffelOrder.id,
      pnr,
      ticketNumbers,
      confirmedAt:   new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    }},
  );

  // 3. Send e-ticket via SES
  const sesFrom = process.env.SES_FROM_EMAIL;
  const paxEmail = order.passengers?.[0]?.email;
  if (sesFrom && paxEmail) {
    try {
      const ses  = new SESClient({});
      const html = generateTicketEmail({
        pnr,
        passengers:    order.passengers,
        flightSummary: order.flightSummary,
        duffelOrderId: duffelOrder.id,
        totalPrice:    order.markedUpPrice,
        currency:      order.currency,
      });
      await ses.send(new SendEmailCommand({
        Source:      sesFrom,
        Destination: { ToAddresses: [paxEmail] },
        Message: {
          Subject: { Data: `Your Lyrtrip Flight Ticket — PNR: ${pnr}` },
          Body: {
            Html: { Data: html },
            Text: { Data: `Your flight is confirmed! PNR: ${pnr}. Check in using this code. Booking ref: ${duffelOrder.id}` },
          },
        },
      }));
      await db.collection('flight_bookings').updateOne(
        { _id: order._id },
        { $set: { emailSent: true, updatedAt: new Date().toISOString() } }
      );
    } catch (emailErr) {
      console.error('SES email failed:', emailErr);
    }
  }

  return json(200, {
    success: true, pnr, duffelOrderId: duffelOrder.id,
    flightOrderId, flightSummary: order.flightSummary,
    passengers: order.passengers, totalPrice: order.markedUpPrice, currency: order.currency,
  });
}

const CITY_TO_IATA = {
  // North America
  'new york':'JFK','nyc':'JFK','new york city':'JFK',
  'los angeles':'LAX','la':'LAX',
  'chicago':'ORD',
  'houston':'IAH',
  'phoenix':'PHX',
  'philadelphia':'PHL','philly':'PHL',
  'san antonio':'SAT',
  'san diego':'SAN',
  'dallas':'DFW','dallas fort worth':'DFW',
  'san jose':'SJC',
  'austin':'AUS',
  'jacksonville':'JAX',
  'fort worth':'DFW',
  'columbus':'CMH',
  'charlotte':'CLT',
  'indianapolis':'IND',
  'san francisco':'SFO','sf':'SFO',
  'seattle':'SEA',
  'denver':'DEN',
  'washington':'DCA','dc':'DCA','washington dc':'IAD',
  'nashville':'BNA',
  'oklahoma city':'OKC',
  'el paso':'ELP',
  'boston':'BOS',
  'portland':'PDX',
  'las vegas':'LAS','vegas':'LAS',
  'memphis':'MEM',
  'louisville':'SDF',
  'baltimore':'BWI',
  'miami':'MIA',
  'atlanta':'ATL',
  'minneapolis':'MSP',
  'new orleans':'MSY',
  'cleveland':'CLE',
  'tampa':'TPA',
  'orlando':'MCO',
  'detroit':'DTW',
  'salt lake city':'SLC',
  'pittsburgh':'PIT',
  'kansas city':'MCI',
  'sacramento':'SMF',
  'cincinnati':'CVG',
  'raleigh':'RDU',
  'richmond':'RIC',
  'buffalo':'BUF',
  'anchorage':'ANC',
  'honolulu':'HNL',
  // Europe
  'london':'LHR','london heathrow':'LHR','london gatwick':'LGW',
  'paris':'CDG','paris cdg':'CDG',
  'amsterdam':'AMS',
  'frankfurt':'FRA',
  'madrid':'MAD',
  'barcelona':'BCN',
  'rome':'FCO',
  'milan':'MXP',
  'munich':'MUC',
  'zurich':'ZRH',
  'vienna':'VIE',
  'brussels':'BRU',
  'lisbon':'LIS',
  'stockholm':'ARN',
  'oslo':'OSL',
  'copenhagen':'CPH',
  'helsinki':'HEL',
  'dublin':'DUB',
  'edinburgh':'EDI',
  'manchester':'MAN',
  'athens':'ATH',
  'istanbul':'IST',
  'warsaw':'WAW',
  'prague':'PRG',
  'budapest':'BUD',
  'bucharest':'OTP',
  // Asia Pacific
  'tokyo':'NRT','tokyo narita':'NRT','tokyo haneda':'HND',
  'beijing':'PEK',
  'shanghai':'PVG',
  'hong kong':'HKG',
  'singapore':'SIN',
  'dubai':'DXB',
  'sydney':'SYD',
  'melbourne':'MEL',
  'seoul':'ICN',
  'bangkok':'BKK',
  'kuala lumpur':'KUL','kl':'KUL',
  'jakarta':'CGK',
  'manila':'MNL',
  'mumbai':'BOM','bombay':'BOM',
  'delhi':'DEL','new delhi':'DEL',
  'bangalore':'BLR',
  'cairo':'CAI',
  'johannesburg':'JNB',
  'nairobi':'NBO',
  'casablanca':'CMN',
  // Americas
  'toronto':'YYZ',
  'vancouver':'YVR',
  'montreal':'YUL',
  'mexico city':'MEX',
  'cancun':'CUN',
  'bogota':'BOG',
  'lima':'LIM',
  'santiago':'SCL',
  'buenos aires':'EZE',
  'sao paulo':'GRU','são paulo':'GRU',
  'rio de janeiro':'GIG','rio':'GIG',
};

function resolveIata(input) {
  if (!input) return input;
  const trimmed = input.trim();
  if (/^[A-Z]{3}$/.test(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  return (CITY_TO_IATA[lower] ?? trimmed).toUpperCase();
}

async function searchFlightsSerpApi({ from, to, depart, returnDate }) {
  const params = new URLSearchParams({
    engine:        'google_flights',
    departure_id:  resolveIata(from),
    arrival_id:    resolveIata(to),
    outbound_date: depart,
    currency:      'USD',
    hl:            'en',
    gl:            'us',
    type:          returnDate ? '1' : '2',
    api_key:       process.env.SERPAPI_KEY,
  });
  if (returnDate) params.set('return_date', returnDate);

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SerpAPI flights error (${res.status}): ${err}`);
  }
  const data = await res.json();

  const mapFlight = (f, isBest, index) => ({
    id:            `${isBest ? 'best' : 'other'}-${index}`,
    type:          'flight',
    isBest,
    price:         f.price,
    totalDuration: f.total_duration,
    airlineLogo:   f.airline_logo,
    legs: (f.flights ?? []).map(leg => ({
      airline:      leg.airline,
      airlineLogo:  leg.airline_logo,
      flightNumber: leg.flight_number,
      departure: {
        airport: leg.departure_airport?.id,
        name:    leg.departure_airport?.name,
        time:    leg.departure_airport?.time,
      },
      arrival: {
        airport: leg.arrival_airport?.id,
        name:    leg.arrival_airport?.name,
        time:    leg.arrival_airport?.time,
      },
      duration:    leg.duration,
      airplane:    leg.airplane,
      travelClass: leg.travel_class,
      legroom:     leg.legroom,
      extensions:  leg.extensions ?? [],
    })),
    layovers: (f.layovers ?? []).map(l => ({
      name:      l.name,
      id:        l.id,
      duration:  l.duration,
      overnight: l.overnight ?? false,
    })),
    extensions:      f.extensions ?? [],
    carbonEmissions: f.carbon_emissions,
    bookingToken:    f.booking_token,
    // generic SearchResult compat fields
    name:        (f.flights?.[0]?.airline ?? 'Flight'),
    description: `${resolveIata(from)} → ${resolveIata(to)}`,
  });

  const best  = (data.best_flights  ?? []).map((f, i) => mapFlight(f, true,  i));
  const other = (data.other_flights ?? []).map((f, i) => mapFlight(f, false, i));
  return [...best, ...other];
}

async function searchJobsSerpApi({ title, location, jobType, datePosted }) {
  let q = title || 'jobs';

  const typeMap   = { 'Full-time': 'full time', 'Part-time': 'part time', 'Contract': 'contract', 'Internship': 'internship' };
  const dateMap   = { today: 'since yesterday', '3days': 'in the last 3 days', week: 'in the last week', month: 'in the last month' };

  if (jobType  && typeMap[jobType])   q += ` ${typeMap[jobType]}`;
  if (datePosted && dateMap[datePosted]) q += ` ${dateMap[datePosted]}`;

  const params = new URLSearchParams({
    engine:  'google_jobs',
    q,
    hl:      'en',
    api_key: process.env.SERPAPI_KEY,
  });
  if (location) params.set('location', location);

  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SerpAPI jobs error (${res.status}): ${err}`);
  }
  const data = await res.json();

  return (data.jobs_results ?? []).map((j, i) => ({
    id:          j.job_id ?? String(i),
    name:        j.title,
    company:     j.company_name,
    jobLocation: j.location,
    via:         j.via,
    description: (j.description ?? '').slice(0, 400),
    salary:      j.detected_extensions?.salary ?? null,
    jobType:     j.detected_extensions?.schedule_type ?? null,
    postedAt:    j.detected_extensions?.posted_at ?? null,
    benefits:    [
      j.detected_extensions?.dental_coverage  ? 'Dental'           : null,
      j.detected_extensions?.health_insurance ? 'Health Insurance' : null,
      j.detected_extensions?.paid_time_off    ? 'PTO'              : null,
      j.detected_extensions?.vision_coverage  ? 'Vision'           : null,
    ].filter(Boolean),
    imageUrl:    j.thumbnail ?? null,
    applyLink:   j.apply_options?.[0]?.link ?? j.share_link ?? null,
    highlights:  (j.job_highlights ?? []).map(h => ({ title: h.title, items: (h.items ?? []).slice(0, 4) })),
    rating:      null,
    price:       null,
  }));
}

async function handleClassroomAssign(event) {
  const { courseId, courseWorkId, studentIds, accessToken } = JSON.parse(event.body || '{}');
  if (!accessToken) return json(401, { error: 'No access token' });
  if (!courseId || !courseWorkId || !Array.isArray(studentIds) || studentIds.length === 0) {
    return json(400, { error: 'courseId, courseWorkId, and studentIds are required' });
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/${courseWorkId}:modifyAssignees`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeMode: 'INDIVIDUAL_STUDENTS',
          modifyIndividualStudentsOptions: { addStudentIds: studentIds },
        }),
      }
    );
    const data = await res.json();
    if (res.ok) return json(200, { success: true, courseWork: data });
    if (res.status === 500 && attempt < 2) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    return json(res.status, { error: data.error?.message || 'Failed to assign coursework' });
  }
}

async function handleSearch(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { service } = body;

    if (!service) {
      return json(200, { message: 'Hello from LyrTrip API!', timestamp: new Date().toISOString() });
    }

    if (!(service in mockData)) {
      return json(400, { error: 'Invalid service type' });
    }

    // --- Hotel: Travelport (bookable) when configured and we have coordinates ---
    if (service === 'hotels' && process.env.TRAVELPORT_CLIENT_ID) {
      const { destinationLocation, checkin, checkout, guests } = body;
      if (destinationLocation?.lat && destinationLocation?.lng && checkin && checkout) {
        try {
          const results = await searchHotelsTravelport({
            lat: destinationLocation.lat, lng: destinationLocation.lng, checkin, checkout, guests,
          });
          if (results.length > 0) {
            return json(200, { success: true, service, results: tvptMarkPreview(results), total: results.length, source: 'travelport' });
          }
        } catch (tvptErr) {
          console.error('Travelport hotel search error (falling back to SerpAPI):', tvptErr.message);
        }
      }
    }

    // --- Hotel: try SerpAPI ---
    if (service === 'hotels' && process.env.SERPAPI_KEY) {
      const { destination, checkin, checkout, guests } = body;
      if (destination) {
        try {
          const results = await searchHotelsSerpApi({ destination, checkin, checkout, guests });
          if (results.length > 0) {
            return json(200, { success: true, service, results, total: results.length, source: 'serpapi' });
          }
        } catch (serpErr) {
          console.error('SerpAPI hotel search error (falling back to mock):', serpErr.message);
        }
      }
    }

    // --- Hotel: try Amadeus if SerpAPI not configured ---
    if (service === 'hotels' && process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) {
      const { destinationLocation, checkin, checkout } = body;
      if (destinationLocation?.lat && destinationLocation?.lng) {
        try {
          const results = await searchHotelsAmadeus({
            lat:      destinationLocation.lat,
            lng:      destinationLocation.lng,
            checkin:  checkin  || null,
            checkout: checkout || null,
          });
          if (results.length > 0) {
            return json(200, { success: true, service, results, total: results.length, source: 'amadeus' });
          }
        } catch (amadeusError) {
          console.error('Amadeus hotel search error (falling back to mock):', amadeusError.message);
        }
      }
    }

    // --- Flights: Travelport → Duffel → SerpAPI → mock ---
    if (service === 'flights') {
      const { from, to, depart, returnDate, passengers } = body;
      if (from && to && depart) {
        if (process.env.TRAVELPORT_CLIENT_ID) {
          try {
            const results = await searchFlightsTravelport({ from, to, depart, returnDate, passengers: Number(passengers || 1) });
            if (results.length > 0) {
              return json(200, { success: true, service, results: tvptMarkPreview(results), total: results.length, source: 'travelport' });
            }
          } catch (tvptErr) {
            console.error('Travelport flight search error (falling back to Duffel):', tvptErr.message);
          }
        }
        if (process.env.DUFFEL_API_KEY) {
          try {
            const results = await searchFlightsDuffel({ from, to, depart, returnDate, passengers: Number(passengers || 1) });
            if (results.length > 0) {
              return json(200, { success: true, service, results, total: results.length, source: 'duffel' });
            }
          } catch (duffelErr) {
            console.error('Duffel flight search error (falling back to SerpAPI):', duffelErr.message);
          }
        }
        if (process.env.SERPAPI_KEY) {
          try {
            const results = await searchFlightsSerpApi({ from, to, depart, returnDate });
            if (results.length > 0) {
              return json(200, { success: true, service, results, total: results.length, source: 'serpapi' });
            }
          } catch (serpErr) {
            console.error('SerpAPI flight search error (falling back to mock):', serpErr.message);
          }
        }
        // Placeholder flights: shown so the page isn't empty, never bookable
        const results = makeMockFlights(from, to, depart).map(r => ({ ...r, demo: true }));
        return json(200, { success: true, service, results, total: results.length, source: 'mock' });
      }
    }

    // --- Jobs (Career): try SerpAPI ---
    if (service === 'career' && process.env.SERPAPI_KEY) {
      const { jobTitle, location, jobType, datePosted } = body;
      if (jobTitle || location) {
        try {
          const results = await searchJobsSerpApi({ title: jobTitle, location, jobType, datePosted });
          if (results.length > 0) {
            return json(200, { success: true, service, results, total: results.length, source: 'serpapi' });
          }
        } catch (serpErr) {
          console.error('SerpAPI jobs search error (falling back to mock):', serpErr.message);
        }
      }
    }

    // --- Bus: try Flixbus API ---
    if (service === 'bus') {
      const { from, to, date, adult } = body;
      if (from && to && date && process.env.FLIXBUS_API_URL && process.env.FLIXBUS_API_KEY) {
        try {
          const results = await searchBusFlixbus({ from, to, date, adult: Number(adult || 1) });
          return json(200, { success: true, service, results, total: results.length, source: 'flixbus' });
        } catch (flixErr) {
          console.error('Flixbus search error (falling back to demo):', flixErr.message);
        }
      }
      return json(200, { success: true, service, results: DEMO_BUS_JOURNEYS, total: DEMO_BUS_JOURNEYS.length, source: 'demo' });
    }

    // --- Fallback to mock data for all services ---
    const results = (mockData[service] || []).map(r => ({ ...r, demo: true }));
    return json(200, { success: true, service, results, total: results.length, source: 'mock' });

  } catch (error) {
    console.error('Search API error:', error);
    return json(500, { error: 'Failed to process search request' });
  }
}

function serializeTour(tour) {
  return { ...tour, id: tour._id?.toString(), _id: undefined };
}

async function listTours(event) {
  const user = await getAuthenticatedUser(event);
  if (!user) return json(401, { error: 'Authentication required' });

  const db   = await getDb();
  const tours = await db.collection('tours').find({ user_id: user.sub }).sort({ created_at: -1 }).toArray();

  return json(200, { success: true, tours: tours.map(serializeTour) });
}

async function createTour(event) {
  const user = await getAuthenticatedUser(event);
  if (!user) return json(401, { error: 'Authentication required' });

  const body = JSON.parse(event.body || '{}');

  if (!body.title || !body.start_date || !body.end_date) {
    return json(400, { error: 'title, start_date, and end_date are required' });
  }

  const now  = new Date().toISOString();
  const tour = {
    user_id:     user.sub,
    title:       String(body.title),
    artist:      body.artist      ? String(body.artist)      : undefined,
    description: body.description ? String(body.description) : undefined,
    start_date:  String(body.start_date),
    end_date:    String(body.end_date),
    total_stops: Number(body.total_stops || 0),
    budget:      Number(body.budget      || 0),
    status:      body.status || 'planning',
    created_at:  now,
    updated_at:  now,
  };

  const db     = await getDb();
  const result = await db.collection('tours').insertOne(tour);

  return json(201, { success: true, tour: serializeTour({ ...tour, _id: result.insertedId }) });
}

async function getTour(event, id) {
  const user = await getAuthenticatedUser(event);
  if (!user) return json(401, { error: 'Authentication required' });

  if (!ObjectId.isValid(id)) return json(400, { error: 'Invalid tour id' });

  const db   = await getDb();
  const tour = await db.collection('tours').findOne({ _id: new ObjectId(id), user_id: user.sub });

  if (!tour) return json(404, { error: 'Tour not found' });

  return json(200, { success: true, tour: serializeTour(tour) });
}

// ---------------------------------------------------------------------------
function nightsBetween(checkin, checkout) {
  if (!checkin || !checkout) return 1;
  const ms = new Date(checkout) - new Date(checkin);
  const nights = Math.round(ms / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 1;
}

const STRIPE_BASE_PRICE = {
  'Free':  0,
  '$':     8900,
  '$$':    16000,
  '$$$':   30000,
  '$$$$':  50000,
};

async function handleStripeCheckout(event) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: 'Stripe is not configured' });

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { hotelName, address, checkin, checkout, guests, guestName, priceLevel, nights: bodyNights, totalPrice } = body;

  const nights       = bodyNights ?? nightsBetween(checkin, checkout);
  const unitCents    = STRIPE_BASE_PRICE[priceLevel] ?? STRIPE_BASE_PRICE['$$'];
  const amountCents  = totalPrice ? Math.round(totalPrice * 100) : unitCents * nights;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: amountCents,
        product_data: {
          name: hotelName,
          description: `${address} · ${nights} night${nights !== 1 ? 's' : ''} · ${guests} guest${guests !== 1 ? 's' : ''}`,
        },
      },
      quantity: 1,
    }],
    metadata: { hotelName, address, checkin, checkout, guests: String(guests), guestName, priceLevel: priceLevel ?? '' },
    customer_email: guestName?.includes('@') ? guestName : undefined,
    success_url: 'https://www.lyrtrip.com/booking/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:  'https://www.lyrtrip.com/booking/cancel',
  });

  return json(200, { url: session.url, sessionId: session.id });
}

// ---------------------------------------------------------------------------
// Uber OAuth — token exchange and profile proxy
// ---------------------------------------------------------------------------

async function handleUberToken(event) {
  const clientId     = process.env.UBER_CLIENT_ID ?? UBER_CLIENT_ID_DEFAULT;
  const clientSecret = process.env.UBER_CLIENT_SECRET;
  if (!clientSecret) return json(500, { error: 'Uber is not configured' });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { code, redirect_uri } = body;
  if (!code || !redirect_uri) return json(400, { error: 'Missing code or redirect_uri' });

  const res = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', redirect_uri, code }),
  });
  const data = await res.json();
  if (!res.ok) return json(400, { error: data.error_description || data.error || 'Token exchange failed' });
  return json(200, { access_token: data.access_token, expires_in: data.expires_in, scope: data.scope });
}

async function handleUberMe(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (!auth) return json(401, { error: 'Missing authorization header' });
  const res = await fetch('https://api.uber.com/v1.2/me', { headers: { Authorization: auth } });
  const data = await res.json();
  if (!res.ok) return json(res.status, { error: data.message || 'Failed to fetch profile' });
  return json(200, data);
}

// ---------------------------------------------------------------------------
// Uber Rides — price estimates via Google Maps Distance Matrix
// ---------------------------------------------------------------------------

const UBER_CLIENT_ID_DEFAULT = 'xuJjFMaEj4AfL-2TP-ql-6bKkA8sMPAB';

// Typical US average rates per ride tier (base + per-mile + per-min)
const RIDE_TIERS = [
  { name: 'UberX',        emoji: '🚗', seats: '1–4', base: 2.50, mile: 1.25, min: 0.25, minFare:  6, spread: 0.18 },
  { name: 'Uber Comfort', emoji: '🛋️', seats: '1–4', base: 3.50, mile: 1.75, min: 0.35, minFare:  9, spread: 0.18 },
  { name: 'UberXL',       emoji: '🚐', seats: '1–6', base: 4.50, mile: 2.00, min: 0.40, minFare: 12, spread: 0.18 },
  { name: 'Uber Black',   emoji: '🖤', seats: '1–4', base: 8.00, mile: 3.50, min: 0.65, minFare: 20, spread: 0.18 },
  { name: 'UberSUV',      emoji: '🚙', seats: '1–6', base: 10.0, mile: 4.50, min: 0.80, minFare: 25, spread: 0.18 },
];

async function handleUberEstimates(event) {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!mapsKey) return json(500, { error: 'Maps API key not configured' });

  const qs = event.queryStringParameters ?? {};
  const { pickupLat, pickupLng, dropoffLat, dropoffLng } = qs;
  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return json(400, { error: 'Missing required coordinates: pickupLat, pickupLng, dropoffLat, dropoffLng' });
  }

  const mapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${pickupLat},${pickupLng}&destinations=${dropoffLat},${dropoffLng}&mode=driving&units=imperial&key=${mapsKey}`;
  const mapsRes = await fetch(mapsUrl);
  if (!mapsRes.ok) return json(502, { error: 'Could not calculate route' });

  const mapsData = await mapsRes.json();
  const element  = mapsData.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') return json(502, { error: 'No driving route found between those locations' });

  const distanceMiles = element.distance.value / 1609.34;
  const durationMins  = element.duration.value / 60;
  const durationSecs  = element.duration.value;

  const rides = RIDE_TIERS.map(t => {
    const mid  = Math.max(t.minFare, t.base + t.mile * distanceMiles + t.min * durationMins);
    const low  = Math.round(mid * (1 - t.spread));
    const high = Math.round(mid * (1 + t.spread));
    return {
      productId:       '',
      name:            t.name,
      lowEstimate:     low,
      highEstimate:    high,
      currencyCode:    'USD',
      duration:        durationSecs,
      distance:        Math.round(distanceMiles * 10) / 10,
      surgeMultiplier: 1,
      emoji:           t.emoji,
      seats:           t.seats,
    };
  });

  return json(200, { rides });
}

async function handleUberCheckout(event) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: 'Stripe is not configured' });

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  const body   = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const {
    rideName, productId, lowEstimate, highEstimate, serviceFee, currencyCode,
    pickupLabel, dropoffLabel,
    pickupLat, pickupLng, dropoffLat, dropoffLng,
    riderEmail,
  } = body;

  const baseFare   = Math.round(((Number(lowEstimate) + Number(highEstimate)) / 2) * 100);
  const feeCents   = serviceFee ? Math.round(Number(serviceFee) * 100) : Math.max(200, Math.round(baseFare * 0.1));
  const fareAmount = baseFare + feeCents;
  const clientId   = process.env.UBER_CLIENT_ID ?? UBER_CLIENT_ID_DEFAULT;

  const uberDeepLink =
    `https://m.uber.com/ul/?action=setPickup&client_id=${clientId}` +
    `&pickup[latitude]=${pickupLat}&pickup[longitude]=${pickupLng}` +
    `&dropoff[latitude]=${dropoffLat}&dropoff[longitude]=${dropoffLng}` +
    (productId ? `&product_id=${encodeURIComponent(productId)}` : '');

  const successUrl =
    `https://www.lyrtrip.com/booking/success?session_id={CHECKOUT_SESSION_ID}` +
    `&type=uber` +
    `&rid=${encodeURIComponent(rideName ?? '')}` +
    `&pickup=${encodeURIComponent(pickupLabel ?? '')}` +
    `&dropoff=${encodeURIComponent(dropoffLabel ?? '')}` +
    `&plat=${pickupLat}&plng=${pickupLng}&dlat=${dropoffLat}&dlng=${dropoffLng}`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     (currencyCode ?? 'usd').toLowerCase(),
        unit_amount:  fareAmount,
        product_data: {
          name:        `${rideName} — Uber Ride`,
          description: `${pickupLabel} → ${dropoffLabel}`,
        },
      },
      quantity: 1,
    }],
    metadata: { type: 'uber_ride', rideName: rideName ?? '', pickupLabel: pickupLabel ?? '', dropoffLabel: dropoffLabel ?? '', uberDeepLink },
    customer_email: riderEmail || undefined,
    success_url: successUrl,
    cancel_url:  'https://www.lyrtrip.com/booking/cancel',
  });

  return json(200, { url: session.url });
}

// Main handler
// ---------------------------------------------------------------------------

export async function handler(event) {
  // Await here so errors thrown inside async route handlers become a JSON 500
  // instead of an unhandled Lambda error (the routes return un-awaited promises).
  try {
    return await routeRequest(event);
  } catch (error) {
    console.error('API error:', error);
    return json(500, { error: 'Failed to process API request' });
  }
}

async function routeRequest(event) {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path   = event.rawPath || event.path || '/';

  if (method === 'OPTIONS') return json(204, {});

  try {
    if (path.endsWith('/api/search'))                                               return handleSearch(event);
    if (path.endsWith('/api/auth/wechat')            && method === 'POST')         return handleWeChatAuth(event);
    if (path.endsWith('/api/stripe-checkout')        && method === 'POST')         return handleStripeCheckout(event);
    if (path.endsWith('/api/flight/checkout')        && method === 'POST')         return handleFlightCheckout(event);
    if (path.endsWith('/api/flight/confirm')         && method === 'POST')         return handleFlightConfirm(event);
    // Travelport — air
    if (path.endsWith('/api/travelport/air/price')   && method === 'POST')         return handleTravelportAirPrice(event);
    if (path.endsWith('/api/travelport/flight/checkout') && method === 'POST')     return handleTravelportFlightCheckout(event);
    if (path.endsWith('/api/travelport/flight/confirm')  && method === 'POST')     return handleTravelportFlightConfirm(event);
    // Travelport — hotel
    if (path.endsWith('/api/travelport/hotel/rooms')    && method === 'POST')      return handleTravelportHotelRooms(event);
    if (path.endsWith('/api/travelport/hotel/checkout') && method === 'POST')      return handleTravelportHotelCheckout(event);
    if (path.endsWith('/api/travelport/hotel/confirm')  && method === 'POST')      return handleTravelportHotelConfirm(event);
    if (path.includes('/api/uber/estimates')         && method === 'GET')          return handleUberEstimates(event);
    if (path.includes('/api/uber/checkout')          && method === 'POST')         return handleUberCheckout(event);
    if (path.includes('/api/uber/token')             && method === 'POST')         return handleUberToken(event);
    if (path.includes('/api/uber/me')                && method === 'GET')          return handleUberMe(event);
    if (path.endsWith('/api/tours')                  && method === 'GET')          return listTours(event);
    if (path.endsWith('/api/tours')                  && method === 'POST')         return createTour(event);

    const tourMatch = path.match(/\/api\/tours\/([^/]+)$/);
    if (tourMatch && method === 'GET') return getTour(event, tourMatch[1]);

    return json(404, { error: 'Route not found' });
  } catch (error) {
    console.error('API error:', error);
    return json(500, { error: 'Failed to process API request' });
  }
}
