'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBookings, updateBookingStatus } from '@/lib/bookings';

interface FlightLeg {
  airline: string;
  flightNumber: string;
  departure: { airport: string; name: string; time: string };
  arrival: { airport: string; name: string; time: string };
}

interface FlightConfirmation {
  pnr: string;
  duffelOrderId?: string;
  bookingRef?: string;
  flightOrderId?: string;
  orderId?: string;
  totalPrice: number;
  currency: string;
  passengers: { givenName: string; familyName: string; email: string }[];
  flightSummary?: { legs?: FlightLeg[]; from?: string; to?: string; depart?: string };
}

interface HotelConfirmation {
  bookingRef: string;
  hotelName: string;
  checkin: string;
  checkout: string;
  nights: number;
  totalPrice: number;
  currency: string;
}

function fmtDateTime(dt: string): string {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dt; }
}

export default function BookingSuccessPage() {
  const [uberInfo, setUberInfo] = useState<{
    rideName: string; pickup: string; dropoff: string; deepLink: string;
  } | null>(null);

  const [flightConfirm, setFlightConfirm]   = useState<FlightConfirmation | null>(null);
  const [flightLoading, setFlightLoading]   = useState(false);
  const [flightError, setFlightError]       = useState<string | null>(null);
  const [hotelConfirm, setHotelConfirm]     = useState<HotelConfirmation | null>(null);

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const type      = params.get('type');
    const baseUrl   = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');

    if (type === 'uber') {
      const plat = params.get('plat');
      const plng = params.get('plng');
      const dlat = params.get('dlat');
      const dlng = params.get('dlng');
      const clientId = 'xuJjFMaEj4AfL-2TP-ql-6bKkA8sMPAB';
      const deepLink =
        `https://m.uber.com/ul/?action=setPickup&client_id=${clientId}` +
        `&pickup[latitude]=${plat}&pickup[longitude]=${plng}` +
        `&dropoff[latitude]=${dlat}&dropoff[longitude]=${dlng}`;
      setUberInfo({
        rideName: params.get('rid') ?? 'Uber Ride',
        pickup:   params.get('pickup') ?? '',
        dropoff:  params.get('dropoff') ?? '',
        deepLink,
      });
      return;
    }

    // Duffel flight confirm
    if (type === 'flight' && sessionId) {
      setFlightLoading(true);
      fetch(`${baseUrl}/api/flight/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) setFlightConfirm(data as FlightConfirmation);
          else setFlightError(data.error ?? 'Booking confirmation failed.');
        })
        .catch(() => setFlightError('Could not reach booking service. Please contact support@lyrtrip.com.'))
        .finally(() => setFlightLoading(false));
      return;
    }

    // Travelport flight confirm
    if (type === 'travelport_flight' && sessionId) {
      setFlightLoading(true);
      fetch(`${baseUrl}/api/travelport/flight/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) setFlightConfirm(data as FlightConfirmation);
          else setFlightError(data.error ?? 'Booking confirmation failed.');
        })
        .catch(() => setFlightError('Could not reach booking service. Please contact support@lyrtrip.com.'))
        .finally(() => setFlightLoading(false));
      return;
    }

    // Travelport hotel confirm
    if (type === 'travelport_hotel' && sessionId) {
      fetch(`${baseUrl}/api/travelport/hotel/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      })
        .then(r => r.json())
        .then(data => { if (data.success) setHotelConfirm(data as HotelConfirmation); })
        .catch(() => {/* fall through to generic hotel success */});
      return;
    }

    // Legacy Stripe hotel — mark local pending as paid
    const pending = getBookings().find(b => b.status === 'pending_payment');
    if (pending) updateBookingStatus(pending.id, 'paid');
  }, []);

  // ── Uber ──────────────────────────────────────────────────────────────────
  if (uberInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold">U</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ride Booked!</h1>
          <p className="text-gray-600 mb-2">Payment confirmed for <span className="font-semibold">{uberInfo.rideName}</span>.</p>
          {uberInfo.pickup && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 text-left mb-6 space-y-1">
              <p>📍 <span className="font-medium">From:</span> {uberInfo.pickup}</p>
              <p>🏁 <span className="font-medium">To:</span> {uberInfo.dropoff}</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <a href={uberInfo.deepLink} className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition text-center">Open Uber App →</a>
            <Link href="/" className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition">Back to Search</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Flight — loading ───────────────────────────────────────────────────────
  if (flightLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl animate-pulse">✈️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Issuing Your Ticket…</h1>
          <p className="text-gray-500">We&apos;re confirming your booking with the airline. This takes a few seconds.</p>
          <div className="mt-6 flex justify-center gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Flight — error ─────────────────────────────────────────────────────────
  if (flightError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Issue</h1>
          <p className="text-gray-600 mb-6">{flightError}</p>
          <div className="flex flex-col gap-3">
            <a href="mailto:support@lyrtrip.com" className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition">Contact Support</a>
            <Link href="/" className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition">Back to Search</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Flight — confirmed with PNR ────────────────────────────────────────────
  if (flightConfirm) {
    const legs  = flightConfirm.flightSummary?.legs ?? [];
    const first = legs[0];
    const last  = legs[legs.length - 1];
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-lg overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-indigo-600 to-violet-600 px-8 py-8 text-center text-white">
            <div className="text-5xl mb-3">✈️</div>
            <h1 className="text-2xl font-bold">Flight Confirmed!</h1>
            <p className="mt-1 opacity-85 text-sm">Your e-ticket has been emailed to {flightConfirm.passengers?.[0]?.email}</p>
          </div>

          {/* PNR */}
          <div className="px-8 py-6 text-center border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">PNR / Check-In Code</p>
            <p className="text-5xl font-black text-indigo-600 tracking-[0.3em]">{flightConfirm.pnr}</p>
            <p className="text-xs text-gray-400 mt-2">Use this code to check in online or at the airport</p>
          </div>

          {/* Flight itinerary */}
          {legs.length > 0 && (
            <div className="px-8 py-5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Itinerary</p>
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between bg-indigo-50 rounded-xl px-4 py-3 mb-2">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">{leg.departure?.airport}</p>
                    <p className="text-xs text-gray-500">{fmtDateTime(leg.departure?.time)}</p>
                  </div>
                  <div className="text-center px-3">
                    <p className="text-indigo-500 text-lg">→</p>
                    <p className="text-xs text-gray-400">{leg.airline} {leg.flightNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-lg">{leg.arrival?.airport}</p>
                    <p className="text-xs text-gray-500">{fmtDateTime(leg.arrival?.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Passengers */}
          {flightConfirm.passengers?.length > 0 && (
            <div className="px-8 py-5 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Passengers</p>
              {flightConfirm.passengers.map((p, i) => (
                <p key={i} className="text-gray-700 text-sm">{p.givenName} {p.familyName}</p>
              ))}
            </div>
          )}

          {/* Total */}
          <div className="px-8 py-4 bg-indigo-50 flex justify-between items-center">
            <span className="text-gray-600 text-sm">Total paid</span>
            <span className="text-indigo-700 font-bold text-lg">{flightConfirm.currency} {flightConfirm.totalPrice?.toFixed(2)}</span>
          </div>

          {/* Booking ref */}
          <div className="px-8 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">Booking ref: {flightConfirm.bookingRef ?? flightConfirm.duffelOrderId}</p>
          </div>

          {/* Actions */}
          <div className="px-8 pb-8 pt-4 flex flex-col gap-3">
            <Link href="/" className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-center">Search More Flights</Link>
            <Link href="/dashboard" className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-center">My Bookings</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Travelport hotel confirmed ────────────────────────────────────────────
  if (hotelConfirm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">
          <div className="bg-linear-to-r from-emerald-600 to-teal-600 px-8 py-8 text-center text-white">
            <div className="text-5xl mb-3">🏨</div>
            <h1 className="text-2xl font-bold">Hotel Confirmed!</h1>
          </div>
          <div className="px-8 py-6 space-y-3 text-sm text-gray-700 border-b border-gray-100">
            <p><span className="font-semibold">Property:</span> {hotelConfirm.hotelName}</p>
            <p><span className="font-semibold">Check-in:</span> {hotelConfirm.checkin}</p>
            <p><span className="font-semibold">Check-out:</span> {hotelConfirm.checkout}</p>
            <p><span className="font-semibold">Nights:</span> {hotelConfirm.nights}</p>
            <p><span className="font-semibold">Booking ref:</span> <span className="font-mono text-indigo-600">{hotelConfirm.bookingRef}</span></p>
          </div>
          <div className="px-8 py-4 bg-emerald-50 flex justify-between items-center">
            <span className="text-gray-600 text-sm">Total paid</span>
            <span className="text-emerald-700 font-bold text-lg">{hotelConfirm.currency} {hotelConfirm.totalPrice?.toFixed(2)}</span>
          </div>
          <div className="px-8 pb-8 pt-4 flex flex-col gap-3">
            <Link href="/" className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition text-center">Search More</Link>
            <Link href="/dashboard" className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-center">My Bookings</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Hotel (default) ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
        <p className="text-gray-600 mb-8">Your payment was successful. Your booking details are saved in your dashboard.</p>
        <div className="flex flex-col gap-3">
          <Link href="/dashboard" className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition">View My Bookings</Link>
          <Link href="/" className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition">Back to Search</Link>
        </div>
      </div>
    </div>
  );
}
