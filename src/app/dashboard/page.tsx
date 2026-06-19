'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { listTours } from '@/lib/api';
import TourCard from '@/components/TourCard';
import type { Tour } from '@/types/database';
import { getBookings, cancelBooking, updateBookingStatus, type Booking } from '@/lib/bookings';

function initialsFor(name?: string, email?: string) {
  if (name) {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return email?.[0]?.toUpperCase() || '?';
}

const providerLabel: Record<string, string> = {
  Google: 'Signed in with Google',
  Facebook: 'Signed in with Facebook',
  WeChat: 'Signed in with WeChat',
  cognito: 'Signed in with email',
};

const UBER_RIDES = [
  { name: 'UberX',       desc: 'Affordable everyday rides',     seats: '1–4', emoji: '🚗', from: 8  },
  { name: 'Uber Comfort', desc: 'Newer cars with extra legroom', seats: '1–4', emoji: '🛋️', from: 12 },
  { name: 'Uber Black',  desc: 'Premium black car service',     seats: '1–4', emoji: '🖤', from: 25 },
];

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tours, setTours] = useState<Tour[]>([]);
  const [toursLoading, setToursLoading] = useState(true);
  const [toursError, setToursError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [uberPickup, setUberPickup] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationReady, setLocationReady] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocationReady(true); },
        () => setLocationReady(true)
      );
    } else {
      setLocationReady(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    listTours()
      .then(res => setTours(res.tours))
      .catch(err => setToursError((err as Error).message || 'Could not load tours.'))
      .finally(() => setToursLoading(false));
    setBookings(getBookings());
  }, [user]);

  const handleCancelBooking = (id: string) => {
    cancelBooking(id);
    setBookings(getBookings());
  };

  const handlePayNow = async (booking: Booking) => {
    const lambdaUrl = process.env.NEXT_PUBLIC_STRIPE_LAMBDA_URL;
    if (!lambdaUrl) return;
    setPayingId(booking.id);
    setPayError(null);
    try {
      const res = await fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hotelName:  booking.hotelName,
          address:    booking.address,
          checkin:    booking.checkin,
          checkout:   booking.checkout,
          guests:     booking.guests,
          guestName:  booking.guestName,
          priceLevel: booking.priceLevel,
          nights:     booking.nights,
          totalPrice: booking.totalPrice,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPayError(data.error || 'Payment failed. Please try again.');
        setPayingId(null);
      }
    } catch (err) {
      console.error('Stripe error:', err);
      setPayError('Could not connect to payment service. Please try again.');
      setPayingId(null);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  const upcoming = tours.filter(t => t.status !== 'completed').length;
  const completed = tours.filter(t => t.status === 'completed').length;

  const activeBookings = bookings.filter(b => b.status !== 'cancelled').length;

  const stats = [
    { label: 'Total tours',  value: tours.length },
    { label: 'Upcoming',     value: upcoming },
    { label: 'Completed',    value: completed },
    { label: 'Bookings',     value: activeBookings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Profile header */}
      <div className="bg-linear-to-br from-indigo-600 to-blue-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-4">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.picture}
                alt=""
                className="w-16 h-16 rounded-full object-cover border-2 border-white/40"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/15 border-2 border-white/40 text-white text-xl font-semibold flex items-center justify-center">
                {initialsFor(user.name, user.email)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back{user.name ? `, ${user.name}` : ''}!
              </h1>
              <p className="text-indigo-100 text-sm mt-1">
                {user.email || providerLabel[user.provider || 'cognito']}
              </p>
              <span className="inline-block mt-2 text-xs font-medium bg-white/15 text-white rounded-full px-3 py-1">
                {providerLabel[user.provider || 'cognito']}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map(stat => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-5"
            >
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            href="/tours/new"
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700 transition-colors"
          >
            + Plan a new tour
          </Link>
          <Link
            href="/tours"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            View all tours
          </Link>
        </div>

        {/* Book a Ride with Uber */}
        <div className="mb-8 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 bg-black rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold">U</span>
            <h2 className="text-lg font-semibold text-gray-900">Book a Ride</h2>
            <span className="ml-auto text-xs text-gray-400">Powered by Uber</span>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
            <input
              type="text"
              value={uberPickup}
              onChange={e => setUberPickup(e.target.value)}
              placeholder={locationReady && userLocation ? '📍 Using your current location' : 'City or address'}
              className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
            />
            {!uberPickup && locationReady && userLocation && (
              <p className="mt-1 text-xs text-gray-400">Auto-detected · type to override</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {UBER_RIDES.map(ride => {
              const uberClientId = process.env.NEXT_PUBLIC_UBER_CLIENT_ID ?? '';
              const pickupParam = uberPickup
                ? `&pickup[formatted_address]=${encodeURIComponent(uberPickup)}`
                : locationReady && userLocation
                  ? `&pickup[latitude]=${userLocation.lat}&pickup[longitude]=${userLocation.lng}`
                  : '';
              const uberHref = `https://m.uber.com/ul/?action=setPickup&client_id=${uberClientId}${pickupParam}`;
              return (
                <div key={ride.name} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition flex flex-col">
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{ride.emoji}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{ride.seats} seats</span>
                  </div>
                  <p className="font-bold text-gray-900 mt-2">{ride.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5 flex-1">{ride.desc}</p>
                  <p className="text-indigo-600 font-semibold text-sm mt-2">From ${ride.from}</p>
                  <a
                    href={uberHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 block w-full text-center py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 transition"
                  >
                    Request {ride.name}
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* My Bookings */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Bookings</h2>
          {bookings.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900">No bookings yet</h3>
              <p className="mt-2 text-gray-600">Search for hotels and click &quot;Book Now&quot; to make a booking</p>
              <Link href="/" className="mt-4 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700">
                Find Hotels
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {bookings.map(booking => (
                <div key={booking.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-sm leading-snug">{booking.hotelName}</h3>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      booking.status === 'paid'            ? 'bg-green-100 text-green-700' :
                      booking.status === 'cancelled'       ? 'bg-red-100 text-red-600' :
                      booking.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {booking.status === 'pending_payment' ? 'Pending Payment' :
                       booking.status === 'paid'            ? 'Paid' :
                       booking.status === 'cancelled'       ? 'Cancelled' : booking.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3 leading-snug">{booking.address}</p>
                  <div className="space-y-1 text-sm text-gray-700">
                    <p>👤 {booking.guestName} · {booking.guests} guest{booking.guests > 1 ? 's' : ''}</p>
                    <p>📅 {booking.checkin || '—'} → {booking.checkout || '—'}</p>
                    <p>🌙 {booking.nights} night{booking.nights > 1 ? 's' : ''} · ${booking.pricePerNight}/night</p>
                    <p className="text-indigo-600 font-bold text-base">Total: ${booking.totalPrice.toLocaleString()}</p>
                  </div>
                  {booking.status === 'pending_payment' && (
                    <>
                      <button
                        onClick={() => handlePayNow(booking)}
                        disabled={payingId === booking.id}
                        className="mt-4 w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {payingId === booking.id ? 'Redirecting…' : 'Pay Now →'}
                      </button>
                      {payError && payingId !== booking.id && (
                        <p className="mt-1 text-xs text-red-600 text-center">{payError}</p>
                      )}
                    </>
                  )}
                  {booking.status === 'pending_payment' && (
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="mt-2 w-full py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                    >
                      Cancel Booking
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent tours */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent tours</h2>
            {tours.length > 0 && (
              <Link href="/tours" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            )}
          </div>

          {toursLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-44 rounded-lg border border-gray-200 bg-white animate-pulse" />
              ))}
            </div>
          ) : toursError ? (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <p className="text-gray-600">{toursError}</p>
            </div>
          ) : tours.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {tours.slice(0, 3).map(tour => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900">No tours yet</h3>
              <p className="mt-2 text-gray-600">Get started by creating your first tour</p>
              <Link
                href="/tours/new"
                className="mt-4 inline-flex rounded-md bg-indigo-600 px-4 py-2 text-white font-medium hover:bg-indigo-700"
              >
                Create tour
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
