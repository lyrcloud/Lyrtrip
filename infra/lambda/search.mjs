import { createHmac } from 'node:crypto';
import Stripe from 'stripe';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { MongoClient, ObjectId } from 'mongodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
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
    propertyToken: p.property_token ?? null,
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
    checkIn:      p.check_in_time,
    checkOut:     p.check_out_time,
  }));
}

// ---------------------------------------------------------------------------
// Duffel flight API integration
// ---------------------------------------------------------------------------

// Price plus margin, rounded up to the cent (toFixed drops float noise: 400 * 1.12 * 100 = 44800.000000000004)
const withMarkup = (amount, markup) => Math.ceil(Number((amount * markup * 100).toFixed(6))) / 100;

const FLIGHT_MARKUP = 1.12; // 12% Lyrtrip margin on the Duffel total (fare + taxes)

async function duffelFetch(path, { method = 'GET', body, timeoutMs } = {}) {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) throw new Error('Duffel not configured');
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Duffel-Version': 'v2',
    'Accept': 'application/json',
  };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`https://api.duffel.com${path}`, {
    method, headers, body, ...(timeoutMs && { signal: AbortSignal.timeout(timeoutMs) }),
  });
  if (!res.ok) {
    const err = new Error(`Duffel (${res.status}) ${path}: ${await res.text()}`);
    err.status = res.status;
    throw err;
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
    const markedUp   = withMarkup(baseTotal, FLIGHT_MARKUP);
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
      idDocsRequired:       !!offer.passenger_identity_documents_required,
      testBooking:          DUFFEL_TEST(),
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

// Duffel test orders are paid with Stripe test cards only, and live orders with live cards only,
// so a test booking never charges a real card and a real ticket is never paid with a test card. DUFFEL_STRIPE_SECRET_KEY overrides the site's key for flight checkouts.
const DUFFEL_TEST = () => (process.env.DUFFEL_API_KEY ?? '').startsWith('duffel_test_');

function duffelStripe() {
  const key = process.env.DUFFEL_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: 'Stripe is not configured' };
  if (DUFFEL_TEST() && !key.startsWith('sk_test_')) {
    return { error: 'Flight booking is in test mode but no Stripe test key is configured' };
  }
  // A live Duffel ticket costs real money, so it must never be paid for with a test card
  if (!DUFFEL_TEST() && !key.startsWith('sk_live_')) {
    return { error: 'Flight booking is temporarily unavailable' };
  }
  return { stripe: new Stripe(key, { apiVersion: '2024-06-20' }) };
}

const SITE_URL = (process.env.SITE_URL || 'https://www.lyrtrip.com').replace(/\/$/, '');

const ADULT_AGE = 18;

// Whole years between a YYYY-MM-DD birth date and another date
function ageOn(dob, on) {
  const [by, bm, bd] = dob.split('-').map(Number);
  const d = new Date(on || Date.now());
  const [y, m, day] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
  return y - by - (m < bm || (m === bm && day < bd) ? 1 : 0);
}

const PAX_TITLES = new Set(['mr', 'ms', 'mrs', 'miss', 'dr']);

// Validates and normalises one passenger from the booking form; returns an error string or the passenger.
function cleanPassenger(p, idDocsRequired, departDate) {
  const s = v => String(v ?? '').trim();
  const out = {
    title:       s(p.title).toLowerCase(),
    givenName:   s(p.givenName),
    familyName:  s(p.familyName),
    dob:         s(p.dob),
    gender:      s(p.gender).toLowerCase() === 'f' ? 'f' : 'm',
    nationality: s(p.nationality).toUpperCase(),
    email:       s(p.email),
  };
  // Numbers typed without a country code are read as local to the passenger's nationality
  const parsed = parsePhoneNumberFromString(s(p.phone), /^[A-Z]{2}$/.test(out.nationality) ? out.nationality : undefined);
  const phone = parsed?.isValid() ? parsed.number : '';
  out.phone = phone;
  if (!PAX_TITLES.has(out.title)) return 'Invalid title';
  if (!out.givenName || !out.familyName) return 'Every passenger needs a first and last name';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.dob) || new Date(out.dob) >= new Date()) return 'Invalid date of birth';
  // Searches only price adult fares, and the airline rejects an adult ticket for a minor's birth date
  if (ageOn(out.dob, departDate) < ADULT_AGE) {
    return `${out.givenName} ${out.familyName} must be ${ADULT_AGE} or older on the travel date (date of birth ${out.dob}). Child and infant tickets can't be booked online yet.`;
  }
  if (!/^[A-Z]{2}$/.test(out.nationality)) return 'Nationality must be a 2-letter country code';
  if (!/^\S+@\S+\.\S+$/.test(out.email)) return 'Invalid email address';
  if (!phone) return `Phone number ${s(p.phone) || '(empty)'} isn't valid — add the country code, e.g. +1 415 555 2671`;
  const passport = s(p.passportNumber);
  if (passport || idDocsRequired) {
    const passportCountry = s(p.passportCountry).toUpperCase();
    const passportExpiry  = s(p.passportExpiry);
    if (!passport) return 'Passport number is required for this flight';
    if (!/^[A-Z]{2}$/.test(passportCountry)) return 'Passport issuing country must be a 2-letter code';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(passportExpiry) || new Date(passportExpiry) <= new Date()) return 'Passport expiry date is invalid';
    Object.assign(out, { passportNumber: passport.toUpperCase(), passportCountry, passportExpiry });
  }
  return out;
}

async function handleFlightCheckout(event) {
  if (!process.env.DUFFEL_API_KEY) return json(500, { error: 'Duffel is not configured' });
  const { stripe, error: stripeError } = duffelStripe();
  if (stripeError) return json(500, { error: stripeError });

  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { duffelOfferId, flightSummary } = body;
  if (!duffelOfferId) return json(400, { error: 'duffelOfferId is required' });
  if (!Array.isArray(body.passengers) || body.passengers.length === 0) return json(400, { error: 'passengers array is required' });

  // Fetch current offer to verify validity and get live price
  let offer;
  try {
    offer = (await duffelFetch(`/air/offers/${duffelOfferId}`)).data;
  } catch (err) {
    return json(400, { error: `Flight offer no longer available: ${err.message}` });
  }
  if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
    return json(400, { error: 'Flight offer has expired. Please search again.' });
  }

  const offerPaxIds = offer.passengers?.map(p => p.id) ?? [];
  if (body.passengers.length !== offerPaxIds.length) {
    return json(400, { error: `This fare is for ${offerPaxIds.length} passenger(s); please search again` });
  }
  const passengers = [];
  for (const p of body.passengers) {
    const clean = cleanPassenger(p, offer.passenger_identity_documents_required, offer.slices?.[0]?.segments?.[0]?.departing_at);
    if (typeof clean === 'string') return json(400, { error: clean });
    passengers.push(clean);
  }

  const numPassengers  = passengers.length;
  const baseTotal      = parseFloat(offer.total_amount || '0');
  const markedUpTotal  = withMarkup(baseTotal, FLIGHT_MARKUP);
  const currency       = offer.total_currency ?? 'USD';

  const segs     = offer.slices?.[0]?.segments ?? [];
  const firstSeg = segs[0];
  const lastSeg  = segs[segs.length - 1];
  const routeName = firstSeg && lastSeg
    ? `${firstSeg.origin?.iata_code} ${offer.slices.length > 1 ? '⇄' : '→'} ${lastSeg.destination?.iata_code}`
    : 'Flight';
  const airlineName = offer.owner?.name ?? firstSeg?.marketing_carrier?.name ?? 'Flight';

  const user = await getAuthenticatedUser(event).catch(() => null);
  const db  = await getDb();
  const now = new Date().toISOString();
  const result = await db.collection('flight_bookings').insertOne({
    status:             'pending_stripe',
    testBooking:        DUFFEL_TEST(),
    userSub:            user?.sub ?? null,
    duffelOfferId,
    duffelPassengerIds: offerPaxIds,
    passengers,
    flightSummary:      flightSummary ?? {},
    basePrice:          baseTotal,
    markedUpPrice:      markedUpTotal,
    currency,
    numPassengers,
    createdAt:          now,
    updatedAt:          now,
  });
  const flightOrderId = result.insertedId.toString();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     currency.toLowerCase(),
        unit_amount:  Math.round(markedUpTotal * 100),
        product_data: {
          name:        `${airlineName} — ${routeName}`,
          description: `${numPassengers} passenger${numPassengers !== 1 ? 's' : ''} · includes taxes & service fees`,
        },
      },
      quantity: 1,
    }],
    metadata: { type: 'flight', flightOrderId },
    customer_email: passengers[0].email,
    // Book or refund well before the offer lapses
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    success_url: `${SITE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&type=flight`,
    cancel_url:  `${SITE_URL}/booking/cancel`,
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

// Receipt fields the success page renders; stored on the booking so a refresh shows the same receipt
function flightReceipt(order, flightOrderId) {
  return {
    success:       true,
    testBooking:   !!order.testBooking,
    pnr:           order.pnr,
    duffelOrderId: order.duffelOrderId,
    orderId:       flightOrderId,
    issuedAt:      order.confirmedAt,
    tickets:       order.tickets ?? [],
    itinerary:     order.itinerary ?? [],
    passengers:    order.passengers.map(p => ({ title: p.title, givenName: p.givenName, familyName: p.familyName, email: p.email })),
    contact:       { email: order.passengers[0]?.email, phone: order.passengers[0]?.phone },
    payment:       order.payment ?? null,
    flightSummary: order.flightSummary,
    totalPrice:    order.markedUpPrice,
    basePrice:     order.basePrice,
    currency:      order.currency,
  };
}

function orderItinerary(duffelOrder) {
  const hhmm = t => (t ?? '').slice(11, 16);
  return (duffelOrder.slices ?? []).flatMap((slice, sliceIdx) => (slice.segments ?? []).map(seg => ({
    direction:        sliceIdx === 0 ? 'Outbound' : 'Return',
    carrier:          seg.marketing_carrier?.name ?? '',
    flightNumber:     `${seg.marketing_carrier?.iata_code ?? ''}${seg.marketing_carrier_flight_number ?? ''}`,
    operatingCarrier: seg.operating_carrier?.name ?? null,
    from:             seg.origin?.iata_code ?? '',
    fromName:         seg.origin?.name ?? '',
    to:               seg.destination?.iata_code ?? '',
    toName:           seg.destination?.name ?? '',
    departureDate:    (seg.departing_at ?? '').slice(0, 10),
    departureTime:    hhmm(seg.departing_at),
    arrivalDate:      (seg.arriving_at ?? '').slice(0, 10),
    arrivalTime:      hhmm(seg.arriving_at),
    duration:         parseDuffelDuration(seg.duration) || null,
    aircraft:         seg.aircraft?.name ?? null,
    cabin:            seg.passengers?.[0]?.cabin_class_marketing_name ?? duffelOrder.cabin_class ?? 'Economy',
    fareBasis:        seg.passengers?.[0]?.fare_basis_code ?? null,
  })));
}

async function stripePaymentDetails(stripe, session) {
  try {
    const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ['latest_charge'] });
    const charge = pi.latest_charge;
    const card = charge?.payment_method_details?.card;
    return {
      brand:      card?.brand ?? null,
      last4:      card?.last4 ?? null,
      paidAt:     new Date((charge?.created ?? pi.created) * 1000).toISOString(),
      receiptUrl: charge?.receipt_url ?? null,
      reference:  pi.id,
    };
  } catch (err) {
    console.error('Stripe payment lookup failed:', err.message);
    return { paidAt: new Date().toISOString(), reference: session.payment_intent };
  }
}

// Some airlines take longer than API Gateway's 30s to ticket. The Lambda runs for up to 120s and
// keeps going after the gateway gives up; the receipt page polls until the order settles.
const DUFFEL_ORDER_TIMEOUT_MS = 90_000;
// A booking still "processing" after this long belongs to a Lambda run that no longer exists
const STALE_PROCESSING_MS = 150_000;

// Finds the Duffel order tagged with this Lyrtrip order id (orders list newest first)
async function findDuffelOrder(flightOrderId, since) {
  let after = '';
  for (let page = 0; page < 4; page++) {
    const res = await duffelFetch(`/air/orders?limit=50${after && `&after=${after}`}`);
    const hit = (res.data ?? []).find(o => o.metadata?.lyrtrip_order_id === flightOrderId);
    if (hit) return hit;
    if (!res.meta?.after || (res.data ?? []).some(o => o.created_at < since)) return null;
    after = res.meta.after;
  }
  return null;
}

async function handleFlightConfirm(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const { sessionId } = body;
  if (!sessionId) return json(400, { error: 'sessionId is required' });

  const { stripe, error: stripeError } = duffelStripe();
  if (stripeError) return json(500, { error: stripeError });

  // 1. Verify Stripe payment
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

  const db   = await getDb();
  const coll = db.collection('flight_bookings');
  const _id  = new ObjectId(flightOrderId);

  // Claim the order atomically so a refresh or second tab can never book twice
  const claimed = await coll.findOneAndUpdate(
    { _id, status: 'pending_stripe', stripeSessionId: sessionId },
    { $set: { status: 'processing', updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  let order = claimed?.value !== undefined ? claimed.value : claimed;
  let recovering = false;
  if (!order) {
    const existing = await coll.findOne({ _id });
    if (!existing) return json(404, { error: 'Flight order not found' });
    if (existing.status === 'confirmed') return json(200, flightReceipt(existing, flightOrderId));
    if (existing.status !== 'processing') {
      return json(500, { error: existing.customerMessage ?? `Booking failed. Contact support@lyrtrip.com with order ID: ${flightOrderId}` });
    }
    if (Date.now() - new Date(existing.updatedAt).getTime() < STALE_PROCESSING_MS) {
      return json(202, { pending: true, message: 'Your ticket is being issued' });
    }
    // The run that claimed this order died mid-booking; take it over (atomically) and settle it
    const retaken = await coll.findOneAndUpdate(
      { _id, status: 'processing', updatedAt: existing.updatedAt },
      { $set: { updatedAt: new Date().toISOString() } },
      { returnDocument: 'after' },
    );
    order = retaken?.value !== undefined ? retaken.value : retaken;
    if (!order) return json(202, { pending: true, message: 'Your ticket is being issued' });
    recovering = true;
  }

  const payment = await stripePaymentDetails(stripe, session);

  const fail = async (reason) => {
    console.error('Duffel booking failed:', reason);
    let refunded = false;
    try {
      await stripe.refunds.create({ payment_intent: session.payment_intent });
      refunded = true;
    } catch (err) {
      console.error('Stripe refund failed:', err.message);
    }
    const customerMessage = refunded
      ? `We couldn't issue this ticket with the airline, so your payment has been refunded in full. Please search again. Order ID: ${flightOrderId}`
      : `We couldn't issue this ticket. Please contact support@lyrtrip.com with order ID ${flightOrderId} for a refund.`;
    await coll.updateOne({ _id }, { $set: {
      status: refunded ? 'refunded' : 'booking_failed', bookingError: String(reason), customerMessage, payment,
      updatedAt: new Date().toISOString(),
    } });
    return json(500, { error: customerMessage });
  };

  // 2. Re-check the fare, then create the Duffel order paid from the Duffel balance
  let duffelOrder;
  if (recovering) {
    try {
      duffelOrder = await findDuffelOrder(flightOrderId, order.createdAt);
    } catch (err) {
      await coll.updateOne({ _id }, { $set: { updatedAt: new Date(0).toISOString() } });  // retry on next poll
      return json(503, { pending: true, message: `Checking booking status: ${err.message}` });
    }
    if (!duffelOrder) return fail('booking run timed out and Duffel has no order for it');
  } else try {
    const offer = (await duffelFetch(`/air/offers/${order.duffelOfferId}`)).data;
    if (parseFloat(offer.total_amount) > order.basePrice + 0.005) {
      return fail(`fare rose from ${order.basePrice} to ${offer.total_amount}`);
    }
    const passengerData = order.passengers.map((p, i) => ({
      id:           order.duffelPassengerIds[i],
      title:        p.title,
      given_name:   p.givenName,
      family_name:  p.familyName,
      born_on:      p.dob,
      gender:       p.gender,
      email:        p.email,
      phone_number: p.phone,
      ...(p.passportNumber && { identity_documents: [{
        type: 'passport', unique_identifier: p.passportNumber,
        issuing_country_code: p.passportCountry, expires_on: p.passportExpiry,
      }] }),
    }));
    duffelOrder = (await duffelFetch('/air/orders', {
      method: 'POST',
      body: JSON.stringify({ data: {
        type:            'instant',
        selected_offers: [order.duffelOfferId],
        passengers:      passengerData,
        payments:        [{ type: 'balance', amount: offer.total_amount, currency: offer.total_currency }],
        metadata:        { lyrtrip_order_id: flightOrderId },
      } }),
      timeoutMs: DUFFEL_ORDER_TIMEOUT_MS,
    })).data;
  } catch (err) {
    // A 4xx is a definite no; a timeout or 5xx may still have booked, so look before refunding
    if (err.status >= 400 && err.status < 500) return fail(err.message);
    duffelOrder = await findDuffelOrder(flightOrderId, order.createdAt).catch(() => null);
    if (!duffelOrder) return fail(err.message);
  }

  const paxName = Object.fromEntries((duffelOrder.passengers ?? []).map(p => [p.id, `${p.family_name}/${p.given_name}`.toUpperCase()]));
  const tickets = (duffelOrder.documents ?? [])
    .filter(d => d.type === 'electronic_ticket' && d.unique_identifier)
    .map(d => ({ number: d.unique_identifier, passenger: paxName[d.passenger_ids?.[0]] ?? '' }));
  // Line tickets up with the passenger list the receipt prints
  const orderedTickets = order.duffelPassengerIds.map(id => tickets.find(t => t.passenger === paxName[id]) ?? { number: '', passenger: paxName[id] ?? '' });

  const confirmed = {
    status:        'confirmed',
    duffelOrderId: duffelOrder.id,
    pnr:           duffelOrder.booking_reference,
    tickets:       orderedTickets,
    itinerary:     orderItinerary(duffelOrder),
    payment,
    confirmedAt:   new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };
  await coll.updateOne({ _id }, { $set: confirmed });
  const receipt = flightReceipt({ ...order, ...confirmed }, flightOrderId);

  // 3. Send e-ticket via SES
  const sesFrom  = process.env.SES_FROM_EMAIL;
  const paxEmail = order.passengers?.[0]?.email;
  if (sesFrom && paxEmail) {
    try {
      const legs = receipt.itinerary.map(s => ({
        airline: s.carrier, flightNumber: s.flightNumber, travelClass: s.cabin,
        departure: { airport: s.from, name: s.fromName, time: `${s.departureDate}T${s.departureTime}` },
        arrival:   { airport: s.to,   name: s.toName,   time: `${s.arrivalDate}T${s.arrivalTime}` },
      }));
      const html = generateTicketEmail({
        pnr:           receipt.pnr,
        tickets:       receipt.tickets,
        passengers:    order.passengers,
        flightSummary: { ...order.flightSummary, legs },
        duffelOrderId: duffelOrder.id,
        totalPrice:    order.markedUpPrice,
        currency:      order.currency,
      });
      await new SESClient({}).send(new SendEmailCommand({
        Source:      sesFrom,
        Destination: { ToAddresses: [paxEmail] },
        Message: {
          Subject: { Data: `${order.testBooking ? '[TEST] ' : ''}Your Lyrtrip Flight Ticket — PNR: ${receipt.pnr}` },
          Body: {
            Html: { Data: html },
            Text: { Data: `Your flight is confirmed! PNR: ${receipt.pnr}. Lyrtrip order: ${flightOrderId}` },
          },
        },
      }));
      await coll.updateOne({ _id }, { $set: { emailSent: true, updatedAt: new Date().toISOString() } });
    } catch (emailErr) {
      console.error('SES email failed:', emailErr);
    }
  }

  return json(200, receipt);
}


// ---------------------------------------------------------------------------
// Hotel booking requests — the guest pays Lyrtrip (hotel total + 12%), then
// Lyrtrip books the room directly with the property and confirms or refunds
// from the admin page (/admin/hotels).
// ---------------------------------------------------------------------------

const HOTEL_MARKUP = 1.12; // 12% Lyrtrip margin on the hotel's total incl. taxes & fees
const HOTEL_MAX_NIGHTS = 30;
const adminEmails = () => (process.env.ADMIN_EMAILS || 'lyrclouds@gmail.com').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const bookingsAlertEmail = () => process.env.BOOKINGS_ALERT_EMAIL || 'lyrtrips@gmail.com';

let idVerifier;
// Admin calls carry the Cognito ID token in the body (the API's CORS only allows content-type)
async function requireAdmin(idToken) {
  if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_USER_POOL_CLIENT_ID) throw new Error('Admin sign-in is not configured');
  idVerifier ??= CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    tokenUse:   'id',
    clientId:   process.env.COGNITO_USER_POOL_CLIENT_ID,
  });
  const claims = await idVerifier.verify(String(idToken ?? ''));
  const email = String(claims.email ?? '').toLowerCase();
  if (!adminEmails().includes(email)) throw new Error('Not an admin account');
  return email;
}

async function sendEmail({ to, subject, html, text }) {
  const from = process.env.SES_FROM_EMAIL;
  if (!from || !to) return false;
  try {
    await new SESClient({}).send(new SendEmailCommand({
      Source: `Lyrtrip <${from}>`,
      Destination: { ToAddresses: [to] },
      Message: { Subject: { Data: subject }, Body: { Html: { Data: html }, Text: { Data: text } } },
    }));
    return true;
  } catch (err) {
    console.error('SES email failed:', to, err.message);
    return false;
  }
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = n => `USD ${Number(n).toFixed(2)}`;

function hotelEmailHtml(title, lines, cta) {
  const rows = lines.map(([k, v]) => `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;width:40%">${esc(k)}</td><td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600">${esc(v)}</td></tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="padding:20px 28px;border-bottom:4px solid #4f46e5"><img src="${SITE_URL}/logo.png" alt="Lyrtrip" height="36"></td></tr>
    <tr><td style="padding:24px 28px"><h1 style="margin:0 0 16px;font-size:20px;color:#111827">${esc(title)}</h1>
      <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      ${cta ? `<p style="margin:24px 0 0"><a href="${esc(cta.url)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${esc(cta.label)}</a></p>` : ''}
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f9fafb;color:#9ca3af;font-size:11px">Lyrtrip · www.lyrtrip.com · support@lyrtrip.com</td></tr>
  </table></td></tr></table></body></html>`;
}

// Re-prices one property from SerpAPI so the charge never trusts a price sent by the browser
async function serpHotelQuote({ propertyToken, destination, checkin, checkout, adults }) {
  if (!process.env.SERPAPI_KEY) throw new Error('Hotel pricing is not configured');
  const params = new URLSearchParams({
    engine: 'google_hotels', q: destination ? `Hotels in ${destination}` : 'Hotels',
    property_token: propertyToken, check_in_date: checkin, check_out_date: checkout,
    adults: String(adults), currency: 'USD', gl: 'us', hl: 'en', api_key: process.env.SERPAPI_KEY,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(25_000) });
  const p = await res.json().catch(() => ({}));
  if (!res.ok || p.error) throw new Error(`Hotel price lookup failed: ${p.error ?? res.status}`);
  const nights  = nightsBetween(checkin, checkout);
  const nightly = p.rate_per_night?.extracted_lowest;
  const total   = p.total_rate?.extracted_lowest ?? (nightly ? nightly * nights : null);
  if (!total) throw new Error('This hotel has no price for these dates. Please try other dates or another hotel.');
  return {
    name: p.name ?? 'Hotel', address: p.address ?? '', phone: p.phone ?? '', link: p.link ?? '',
    imageUrl: p.images?.[0]?.thumbnail ?? null, nights, nightly: nightly ?? total / nights,
    hotelTotal: Math.round(total * 100) / 100,
  };
}

function hotelReceipt(b) {
  return {
    success:           true,
    status:            b.status,                 // requested | confirmed | declined
    requestRef:        String(b._id),
    // the hotel's own website is for admins only (see the admin list)
    hotel:             { name: b.hotel.name, address: b.hotel.address, phone: b.hotel.phone },
    checkin:           b.checkin,
    checkout:          b.checkout,
    nights:            b.nights,
    adults:            b.adults,
    roomPreference:    b.roomPreference,
    specialRequests:   b.specialRequests,
    guest:             b.guest,
    hotelTotal:        b.hotelTotal,
    serviceFee:        Math.round((b.totalPrice - b.hotelTotal) * 100) / 100,
    totalPrice:        b.totalPrice,
    currency:          b.currency,
    payment:           b.payment ?? null,
    requestedAt:       b.requestedAt,
    hotelConfirmation: b.hotelConfirmation ?? null,
    confirmedAt:       b.confirmedAt ?? null,
    declineReason:     b.declineReason ?? null,
    refunded:          !!b.refunded,
  };
}

async function handleHotelCheckout(event) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: 'Payments are not configured' });
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const s = v => String(v ?? '').trim();

  const propertyToken = s(body.propertyToken);
  const checkin  = s(body.checkin), checkout = s(body.checkout);
  const adults   = Number(body.adults ?? 1);
  const today    = new Date().toISOString().slice(0, 10);
  if (!propertyToken) return json(400, { error: 'propertyToken is required' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout) || checkin < today || checkout <= checkin) {
    return json(400, { error: 'Please choose valid check-in and check-out dates' });
  }
  if (nightsBetween(checkin, checkout) > HOTEL_MAX_NIGHTS) return json(400, { error: `Stays are limited to ${HOTEL_MAX_NIGHTS} nights online` });
  if (!Number.isInteger(adults) || adults < 1 || adults > 4) return json(400, { error: 'Guests must be between 1 and 4' });

  const g = body.guest ?? {};
  const guest = { givenName: s(g.givenName), familyName: s(g.familyName), email: s(g.email), country: s(g.country).toUpperCase() };
  if (!guest.givenName || !guest.familyName) return json(400, { error: 'Please enter the guest’s first and last name' });
  if (!/^\S+@\S+\.\S+$/.test(guest.email)) return json(400, { error: 'Please enter a valid email address' });
  const phone = parsePhoneNumberFromString(s(g.phone), /^[A-Z]{2}$/.test(guest.country) ? guest.country : 'US');
  if (!phone?.isValid()) return json(400, { error: `Phone number ${s(g.phone) || '(empty)'} isn't valid — include the country code, e.g. +1 415 555 2671` });
  guest.phone = phone.number;

  let quote;
  try {
    quote = await serpHotelQuote({ propertyToken, destination: s(body.destination), checkin, checkout, adults });
  } catch (err) {
    return json(502, { error: err.message });
  }
  const totalPrice = withMarkup(quote.hotelTotal, HOTEL_MARKUP);
  // The guest agreed to a price in the form; if the hotel's rate rose since, show the new one first
  const agreed = Number(body.quotedTotal);
  if (!(agreed > 0) || totalPrice > agreed + 0.5) {
    return json(409, { priceChanged: true, totalPrice, hotelTotal: quote.hotelTotal, nightly: quote.nightly, nights: quote.nights,
      error: `The price for these dates is now ${usd(totalPrice)}. Please review and continue.` });
  }

  const now = new Date().toISOString();
  const db = await getDb();
  const doc = {
    status:          'pending_stripe',
    propertyToken,
    hotel:           { name: quote.name, address: quote.address, phone: quote.phone, link: quote.link, imageUrl: quote.imageUrl },
    checkin, checkout, nights: quote.nights, adults,
    roomPreference:  s(body.roomPreference).slice(0, 60),
    specialRequests: s(body.specialRequests).slice(0, 500),
    guest,
    hotelNightly:    quote.nightly,
    hotelTotal:      quote.hotelTotal,
    totalPrice,
    currency:        'USD',
    createdAt:       now,
    updatedAt:       now,
  };
  const { insertedId } = await db.collection('hotel_bookings').insertOne(doc);
  const hotelBookingId = insertedId.toString();

  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency:     'usd',
        unit_amount:  Math.round(totalPrice * 100),
        product_data: {
          name:        `${quote.name} — ${quote.nights} night${quote.nights !== 1 ? 's' : ''}`,
          description: `${checkin} → ${checkout} · ${adults} guest${adults !== 1 ? 's' : ''} · incl. taxes, fees & Lyrtrip service fee`,
        },
      },
      quantity: 1,
    }],
    metadata:       { type: 'hotel_request', hotelBookingId },
    customer_email: guest.email,
    expires_at:     Math.floor(Date.now() / 1000) + 30 * 60,
    success_url:    `${SITE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&type=hotel`,
    cancel_url:     `${SITE_URL}/booking/cancel`,
  });
  await db.collection('hotel_bookings').updateOne({ _id: insertedId }, { $set: { stripeSessionId: session.id } });
  return json(200, { url: session.url, hotelBookingId });
}

// Called by the receipt page after Stripe; also how the guest re-opens their booking later
async function handleHotelConfirm(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  if (!body.sessionId) return json(400, { error: 'sessionId is required' });
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(500, { error: 'Payments are not configured' });
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' });

  let session;
  try { session = await stripe.checkout.sessions.retrieve(body.sessionId); } catch { return json(400, { error: 'Invalid session ID' }); }
  if (session.metadata?.type !== 'hotel_request') return json(400, { error: 'Not a hotel booking' });
  if (session.payment_status !== 'paid') return json(402, { error: 'Payment not completed' });
  const id = session.metadata.hotelBookingId;
  if (!ObjectId.isValid(id)) return json(400, { error: 'Invalid booking' });

  const coll = (await getDb()).collection('hotel_bookings');
  const _id = new ObjectId(id);
  const payment = await stripePaymentDetails(stripe, session);
  const claimed = await coll.findOneAndUpdate(
    { _id, status: 'pending_stripe', stripeSessionId: session.id },
    { $set: { status: 'requested', payment, paymentIntent: session.payment_intent, requestedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' },
  );
  const fresh = claimed?.value !== undefined ? claimed.value : claimed;
  if (!fresh) {
    const existing = await coll.findOne({ _id });
    return existing ? json(200, hotelReceipt(existing)) : json(404, { error: 'Booking not found' });
  }

  const receiptUrl = `${SITE_URL}/booking/success?session_id=${session.id}&type=hotel`;
  const details = [
    ['Hotel', fresh.hotel.name], ['Dates', `${fresh.checkin} → ${fresh.checkout} (${fresh.nights} night${fresh.nights !== 1 ? 's' : ''})`],
    ['Guests', fresh.adults], ['Guest name', `${fresh.guest.givenName} ${fresh.guest.familyName}`],
    ['Total paid', usd(fresh.totalPrice)], ['Request reference', id],
  ];
  await sendEmail({
    to: bookingsAlertEmail(),
    subject: `New hotel request: ${fresh.hotel.name}, ${fresh.checkin} (${usd(fresh.totalPrice)})`,
    html: hotelEmailHtml('New hotel booking request', [
      ...details, ['Email', fresh.guest.email], ['Phone', fresh.guest.phone], ['Hotel phone', fresh.hotel.phone || '—'],
      ['Room preference', fresh.roomPreference || '—'], ['Special requests', fresh.specialRequests || '—'],
      ['Hotel quoted (pay up to)', usd(fresh.hotelTotal)],
    ], { url: `${SITE_URL}/admin/hotels`, label: 'Open admin page' }),
    text: `New hotel request ${id}: ${fresh.hotel.name} ${fresh.checkin}→${fresh.checkout}. Manage at ${SITE_URL}/admin/hotels`,
  });
  await sendEmail({
    to: fresh.guest.email,
    subject: `We received your booking request — ${fresh.hotel.name}`,
    html: hotelEmailHtml('We’re booking your room', [
      ...details, ['What happens next', 'We are reserving your room directly with the hotel and will email your hotel confirmation number, usually within 24 hours. If the hotel can’t confirm, you’ll get a full refund.'],
    ], { url: receiptUrl, label: 'View your booking' }),
    text: `We received your booking request for ${fresh.hotel.name}. Track it at ${receiptUrl}`,
  });
  return json(200, hotelReceipt(fresh));
}

// Admin page actions: list, confirm (hotel confirmation number), decline (full refund)
async function handleHotelAdmin(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  try {
    await requireAdmin(body.idToken);
  } catch (err) {
    return json(401, { error: `Sign in with an admin account (${err.message})` });
  }
  const coll = (await getDb()).collection('hotel_bookings');

  if (body.action === 'list') {
    const rows = await coll.find({ status: { $in: ['requested', 'confirmed', 'declined'] } }).sort({ requestedAt: -1 }).limit(200).toArray();
    return json(200, { bookings: rows.map(b => ({ ...hotelReceipt(b), hotel: b.hotel, hotelNightly: b.hotelNightly, adminNote: b.adminNote ?? null })) });
  }

  if (!ObjectId.isValid(body.id)) return json(400, { error: 'Invalid booking id' });
  const _id = new ObjectId(body.id);
  const now = new Date().toISOString();

  if (body.action === 'confirm') {
    const conf = String(body.hotelConfirmation ?? '').trim().slice(0, 60);
    if (!conf) return json(400, { error: 'Enter the hotel confirmation number' });
    const r = await coll.findOneAndUpdate(
      { _id, status: 'requested' },
      { $set: { status: 'confirmed', hotelConfirmation: conf, adminNote: String(body.note ?? '').slice(0, 500), confirmedAt: now, updatedAt: now } },
      { returnDocument: 'after' },
    );
    const b = r?.value !== undefined ? r.value : r;
    if (!b) return json(409, { error: 'This request is no longer awaiting confirmation' });
    await sendEmail({
      to: b.guest.email,
      subject: `Confirmed: ${b.hotel.name}, ${b.checkin} — confirmation ${conf}`,
      html: hotelEmailHtml('Your hotel is confirmed', [
        ['Hotel', b.hotel.name], ['Address', b.hotel.address || '—'], ['Hotel confirmation number', conf],
        ['Dates', `${b.checkin} → ${b.checkout}`], ['Guests', b.adults], ['Guest name', `${b.guest.givenName} ${b.guest.familyName}`],
        ['Total paid', usd(b.totalPrice)],
      ], { url: `${SITE_URL}/booking/success?session_id=${b.stripeSessionId}&type=hotel`, label: 'View your receipt' }),
      text: `Your stay at ${b.hotel.name} is confirmed. Hotel confirmation: ${conf}.`,
    });
    return json(200, { booking: hotelReceipt(b) });
  }

  if (body.action === 'decline') {
    const reason = String(body.reason ?? '').trim().slice(0, 300) || 'The hotel could not confirm this room.';
    const r = await coll.findOneAndUpdate(
      { _id, status: 'requested' },
      { $set: { status: 'declining', updatedAt: now } },
      { returnDocument: 'after' },
    );
    const b = r?.value !== undefined ? r.value : r;
    if (!b) return json(409, { error: 'This request is no longer awaiting confirmation' });
    let refunded = false;
    try {
      await new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }).refunds.create({ payment_intent: b.paymentIntent });
      refunded = true;
    } catch (err) {
      console.error('Hotel refund failed:', err.message);
    }
    const done = { status: refunded ? 'declined' : 'requested', ...(refunded && { refunded: true, declineReason: reason, declinedAt: now }), updatedAt: new Date().toISOString() };
    await coll.updateOne({ _id }, { $set: done });
    if (!refunded) return json(500, { error: 'The refund failed, so the request was left open. Try again or refund it in Stripe.' });
    await sendEmail({
      to: b.guest.email,
      subject: `Refunded: we couldn't book ${b.hotel.name}`,
      html: hotelEmailHtml('We couldn’t book this room', [
        ['Hotel', b.hotel.name], ['Dates', `${b.checkin} → ${b.checkout}`], ['Reason', reason],
        ['Refund', `${usd(b.totalPrice)} refunded to your card (allow 5–10 business days)`],
      ], { url: `${SITE_URL}/`, label: 'Search other hotels' }),
      text: `We couldn't book ${b.hotel.name}: ${reason}. ${usd(b.totalPrice)} has been refunded.`,
    });
    return json(200, { booking: hotelReceipt({ ...b, ...done }) });
  }

  return json(400, { error: 'Unknown action' });
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

// Airport/city lookup by name via Duffel Places, cached per warm Lambda
const placeCache = new Map();

async function searchPlaces(query) {
  const key = query.trim().toLowerCase();
  if (key.length < 2) return [];
  if (placeCache.has(key)) return placeCache.get(key);
  const data = await duffelFetch(`/places/suggestions?query=${encodeURIComponent(key)}`, { timeoutMs: 5000 });
  const places = (data.data ?? [])
    .filter(p => p.iata_code)
    .slice(0, 8)
    .map(p => ({
      code:    p.iata_code,
      type:    p.type,                                  // 'city' (all its airports) or 'airport'
      name:    p.name,
      city:    p.city_name ?? (p.type === 'city' ? p.name : ''),
      country: p.iata_country_code ?? '',
    }));
  if (placeCache.size > 500) placeCache.clear();
  placeCache.set(key, places);
  return places;
}

// "London (LON)", "lhr", "Heathrow", "Lagos" → IATA code, or null if nothing matches
async function resolvePlace(input) {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  const tagged = trimmed.match(/\(([A-Za-z]{3})\)\s*$/);
  if (tagged) return tagged[1].toUpperCase();
  const known = CITY_TO_IATA[trimmed.toLowerCase()];
  if (known) return known;
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  if (process.env.DUFFEL_API_KEY) {
    try {
      const [best] = await searchPlaces(trimmed);
      if (best) return best.code;
    } catch (err) {
      console.error('Duffel place lookup failed:', err.message);
    }
  }
  return null;
}

async function handleFlightPlaces(event) {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : (event.body ?? {});
  const query = String(body.query ?? '').slice(0, 100);
  if (!process.env.DUFFEL_API_KEY) return json(200, { places: [] });
  try {
    return json(200, { places: await searchPlaces(query) });
  } catch (err) {
    console.error('Duffel place search failed:', err.message);
    return json(200, { places: [] });
  }
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

// Study: schools/colleges/universities from Google Maps; admission and scholarship info from Google web results
const STUDY_LEVELS = { school: 'schools', college: 'colleges', institute: 'institutes', university: 'universities' };

async function searchStudySerpApi({ category, level, query, location }) {
  const kind  = STUDY_LEVELS[level] || 'schools colleges universities';
  const where = location ? ` in ${location}` : '';
  const year  = new Date().getFullYear();
  const keywords = (query || '').trim();

  if (category === 'academy') {
    const params = new URLSearchParams({
      engine:  'google_maps',
      type:    'search',
      q:       `${keywords ? `${keywords} ` : ''}${kind}${where}`,
      hl:      'en',
      api_key: process.env.SERPAPI_KEY,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`SerpAPI study (maps) error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return (data.local_results ?? []).map((p, i) => ({
      id:          p.place_id ?? String(i),
      kind:        'place',
      name:        p.title,
      placeType:   p.type ?? null,
      address:     p.address ?? null,
      rating:      p.rating ?? null,
      reviewCount: p.reviews ?? null,
      website:     p.website ?? null,
      phone:       p.phone ?? null,
      openState:   p.open_state ?? null,
      imageUrl:    p.thumbnail ?? null,
      mapsLink:    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.title} ${p.address ?? ''}`.trim())}${p.place_id ? `&query_place_id=${p.place_id}` : ''}`,
      price:       null,
    }));
  }

  const topic = category === 'admission' ? `admission ${year}` : `scholarships ${year}`;
  const params = new URLSearchParams({
    engine:  'google',
    q:       `${keywords || kind} ${topic}${where}`,
    hl:      'en',
    num:     '10',
    api_key: process.env.SERPAPI_KEY,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`SerpAPI study (web) error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return (data.organic_results ?? []).map((r, i) => ({
    id:          String(r.position ?? i),
    kind:        'link',
    name:        r.title,
    description: r.snippet ?? '',
    link:        r.link,
    source:      r.source ?? (() => { try { return new URL(r.link).hostname.replace(/^www\./, ''); } catch { return null; } })(),
    favicon:     r.favicon ?? null,
    postedAt:    r.date ?? null,
    rating:      null,
    price:       null,
  }));
}

// Events: Google Events via SerpAPI (concerts, festivals, sports, shows...)
const EVENT_WHEN = { today: 'date:today', tomorrow: 'date:tomorrow', weekend: 'date:weekend', week: 'date:week', next_week: 'date:next_week', month: 'date:month', next_month: 'date:next_month' };

async function searchEventsSerpApi({ location, category, query, when }) {
  const what = [query, category].map(v => (v || '').trim()).filter(Boolean).join(' ') || 'events';
  const params = new URLSearchParams({
    engine:  'google_events',
    q:       `${what} in ${location}`,
    hl:      'en',
    api_key: process.env.SERPAPI_KEY,
  });
  if (EVENT_WHEN[when]) params.set('htichips', EVENT_WHEN[when]);
  const res = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`SerpAPI events error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return (data.events_results ?? []).map((e, i) => {
    const tickets = (e.ticket_info ?? []).filter(t => t.link);
    const ticket  = tickets.find(t => t.link_type === 'tickets') ?? null;
    return {
      id:          `${i}-${e.title}`,
      name:        e.title,
      when:        e.date?.when ?? null,
      startDate:   e.date?.start_date ?? null,
      address:     (e.address ?? []).join(', ') || null,
      venue:       e.venue?.name ?? null,
      rating:      e.venue?.rating ?? null,
      reviewCount: e.venue?.reviews ?? null,
      description: (e.description ?? '').slice(0, 300),
      imageUrl:    e.image ?? e.thumbnail ?? null,
      link:        e.link ?? null,
      ticketLink:  ticket?.link ?? null,
      ticketSource: ticket?.source ?? null,
      mapsLink:    e.event_location_map?.link ?? null,
      price:       null,
    };
  });
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

    // --- Flights: Duffel → SerpAPI → mock ---
    if (service === 'flights') {
      const { depart, returnDate, passengers } = body;
      if (body.from && body.to && depart) {
        const [from, to] = await Promise.all([resolvePlace(body.from), resolvePlace(body.to)]);
        if (!from || !to) {
          const missing = !from ? body.from : body.to;
          return json(200, { success: true, service, results: [], total: 0, source: 'none', error: `No airport found for "${missing}"` });
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

    // --- Events: SerpAPI Google Events (no placeholder data) ---
    if (service === 'events') {
      const { location, category, query, when } = body;
      if (!location || !String(location).trim()) return json(400, { error: 'Location is required' });
      if (!process.env.SERPAPI_KEY) return json(200, { success: true, service, results: [], total: 0, error: 'Event search is not available right now' });
      try {
        const results = await searchEventsSerpApi({ location: String(location).trim(), category, query, when });
        return json(200, { success: true, service, results, total: results.length, source: 'serpapi' });
      } catch (serpErr) {
        console.error('SerpAPI events search error:', serpErr.message);
        return json(200, { success: true, service, results: [], total: 0, error: 'Event search is temporarily unavailable' });
      }
    }

    // --- Study: SerpAPI (no placeholder data) ---
    if (service === 'study') {
      const { category, level, query, location } = body;
      if (!['academy', 'admission', 'scholarship'].includes(category)) return json(400, { error: 'Unknown study category' });
      if (!process.env.SERPAPI_KEY) return json(200, { success: true, service, results: [], total: 0, error: 'Study search is not available right now' });
      try {
        const results = await searchStudySerpApi({ category, level, query, location });
        return json(200, { success: true, service, results, total: results.length, source: 'serpapi' });
      } catch (serpErr) {
        console.error('SerpAPI study search error:', serpErr.message);
        return json(200, { success: true, service, results: [], total: 0, error: 'Study search is temporarily unavailable' });
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
    if (path.endsWith('/api/flight/places')          && method === 'POST')         return handleFlightPlaces(event);
    if (path.endsWith('/api/flight/checkout')        && method === 'POST')         return handleFlightCheckout(event);
    if (path.endsWith('/api/flight/confirm')         && method === 'POST')         return handleFlightConfirm(event);
    if (path.endsWith('/api/hotel/checkout')         && method === 'POST')         return handleHotelCheckout(event);
    if (path.endsWith('/api/hotel/confirm')          && method === 'POST')         return handleHotelConfirm(event);
    if (path.endsWith('/api/hotel/admin')            && method === 'POST')         return handleHotelAdmin(event);
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
