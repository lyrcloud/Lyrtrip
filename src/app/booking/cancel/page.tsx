'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { rewardsCall } from '@/lib/rewards';

export default function BookingCancelPage() {
  // End the unpaid checkout so any coupon, gift card or points it held come back now
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) rewardsCall({ action: 'release', sessionId, type: params.get('type') }).catch(() => {});
  }, []);

  return (
    <div className="flex-1 bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-gray-600 mb-8">No charge was made. You can go back and try again.</p>
        <Link
          href="/"
          className="w-full inline-block py-3 bg-btn text-white font-semibold rounded-xl hover:bg-btn-hover transition"
        >
          Back to Search
        </Link>
      </div>
    </div>
  );
}
