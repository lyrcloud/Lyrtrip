'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { getBookings, updateBookingStatus, type Booking } from '@/lib/bookings';

export default function BookingSuccessPage() {
  useEffect(() => {
    const pending = getBookings().find(b => b.status === 'pending_payment');
    if (pending) updateBookingStatus(pending.id, 'paid');
  }, []);

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
          <Link
            href="/dashboard"
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition"
          >
            View My Bookings
          </Link>
          <Link
            href="/"
            className="w-full py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
          >
            Back to Search
          </Link>
        </div>
      </div>
    </div>
  );
}
