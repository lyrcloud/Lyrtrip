'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBookings, updateBookingStatus } from '@/lib/bookings';

export default function BookingSuccessPage() {
  const [uberInfo, setUberInfo] = useState<{
    rideName: string; pickup: string; dropoff: string; deepLink: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('type') === 'uber') {
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

    // Hotel booking — mark pending as paid
    const pending = getBookings().find(b => b.status === 'pending_payment');
    if (pending) updateBookingStatus(pending.id, 'paid');
  }, []);

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
            <a
              href={uberInfo.deepLink}
              className="w-full py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 transition text-center"
            >
              Open Uber App →
            </a>
            <Link href="/" className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition">
              Back to Search
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          <Link href="/dashboard" className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition">
            View My Bookings
          </Link>
          <Link href="/" className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition">
            Back to Search
          </Link>
        </div>
      </div>
    </div>
  );
}
