import { createHmac } from 'node:crypto';
import Stripe from 'stripe';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { MongoClient, ObjectId } from 'mongodb';
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

const mockData = {
  hotels: [
    { id: '1', name: 'Luxury Palace Hotel', description: '5-star hotel with ocean view', rating: 4.8, price: 250, unit: '/night' },
    { id: '2', name: 'Downtown Inn', description: 'Modern boutique hotel in city center', rating: 4.5, price: 120, unit: '/night' },
    { id: '3', name: 'Budget Stay', description: 'Affordable accommodation with good service', rating: 4.2, price: 65, unit: '/night' },
  ],
  flights: [
    { id: '1', name: 'Emirates Flight EK123', description: 'Direct flight, Business class available', rating: 4.7, price: 450 },
    { id: '2', name: 'Swiss International Flight', description: '1 stop, Economy and Business', rating: 4.6, price: 380 },
    { id: '3', name: 'Budget Airline Flight', description: 'Low cost carrier, Direct', rating: 4.1, price: 180 },
  ],
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
    const client = new MongoClient(process.env.MONGODB_URI);
    mongoClientPromise = client.connect();
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

    // --- Hotel: try SerpAPI first ---
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

    // --- Flights: try SerpAPI ---
    if (service === 'flights' && process.env.SERPAPI_KEY) {
      const { from, to, depart, returnDate } = body;
      if (from && to && depart) {
        try {
          const results = await searchFlightsSerpApi({ from, to, depart, returnDate });
          if (results.length > 0) {
            return json(200, { success: true, service, results, total: results.length, source: 'serpapi' });
          }
        } catch (serpErr) {
          console.error('SerpAPI flight search error (falling back to mock):', serpErr.message);
        }
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
    const results = mockData[service] || [];
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

const UBER_CLIENT_SECRET_DEFAULT = process.env.UBER_CLIENT_SECRET;

async function handleUberToken(event) {
  const clientId     = process.env.UBER_CLIENT_ID     ?? UBER_CLIENT_ID_DEFAULT;
  const clientSecret = process.env.UBER_CLIENT_SECRET ?? UBER_CLIENT_SECRET_DEFAULT;

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
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path   = event.rawPath || event.path || '/';

  if (method === 'OPTIONS') return json(204, {});

  try {
    if (path.endsWith('/api/search'))                                        return handleSearch(event);
    if (path.endsWith('/api/auth/wechat')       && method === 'POST')        return handleWeChatAuth(event);
    if (path.endsWith('/api/stripe-checkout')   && method === 'POST')        return handleStripeCheckout(event);
    if (path.includes('/api/uber/estimates')    && method === 'GET')         return handleUberEstimates(event);
    if (path.includes('/api/uber/checkout')     && method === 'POST')        return handleUberCheckout(event);
    if (path.includes('/api/uber/token')        && method === 'POST')        return handleUberToken(event);
    if (path.includes('/api/uber/me')           && method === 'GET')         return handleUberMe(event);
    if (path.endsWith('/api/tours')             && method === 'GET')         return listTours(event);
    if (path.endsWith('/api/tours')             && method === 'POST')        return createTour(event);

    const tourMatch = path.match(/\/api\/tours\/([^/]+)$/);
    if (tourMatch && method === 'GET') return getTour(event, tourMatch[1]);

    return json(404, { error: 'Route not found' });
  } catch (error) {
    console.error('API error:', error);
    return json(500, { error: 'Failed to process API request' });
  }
}
