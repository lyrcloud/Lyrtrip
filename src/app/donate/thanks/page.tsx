'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { donationsCall, type Donation } from '@/lib/donations';

const card = 'bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-5 sm:p-6';
const usd = (n: number) => `$${n.toFixed(2)}`;
const STATUS: Record<string, [string, string]> = {
  paid: ['Received: being passed on', 'bg-sky-100 text-sky-800'], forwarded: ['Passed on to the charity', 'bg-emerald-100 text-emerald-800'],
  refunded: ['Refunded', 'bg-gray-200 text-gray-700'],
};

// After paying a donation; signed-in donors also see their earlier donations
export default function DonationThanksPage() {
  const { user } = useAuth();
  const [donation, setDonation] = useState<Donation | null>(null);
  const [mine, setMine] = useState<Donation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id');
    if (!sessionId) return;
    donationsCall<{ donation: Donation }>({ action: 'confirm', sessionId })
      .then(d => setDonation(d.donation))
      .catch(err => setError(err instanceof Error ? err.message : 'Could not confirm your donation.'));
  }, []);

  useEffect(() => {
    if (!user) return;
    donationsCall<{ donations: Donation[] }>({ action: 'mine' }).then(d => setMine(d.donations)).catch(() => setMine([]));
  }, [user, donation]);

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {donation ? (
          <div className={`${card} text-center`}>
            <p className="text-4xl" aria-hidden>💚</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Thank you</h1>
            <p className="mt-2 text-gray-700">Your {donation.giftType.toLowerCase()} of <b>{usd(donation.amount)}</b> for <b>{donation.charity}</b> has been received.</p>
            <p className="mt-1 text-sm text-gray-600">Lyrtrip passes it on in full and emails you when it reaches them. Reference {donation.id}.</p>
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
        ) : (
          <div className={`${card} text-center`}><h1 className="text-2xl font-bold text-gray-900">My donations</h1></div>
        )}
        {mine && mine.length > 0 && (
          <div className={card}>
            <h2 className="font-bold text-gray-900 mb-2">My donations</h2>
            <div className="divide-y divide-gray-100">
              {mine.map(d => (
                <div key={d.id} className="py-3 flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-semibold text-gray-900">{usd(d.amount)} · {d.charity}</p>
                    <p className="text-xs text-gray-500">{d.giftType} · {d.cause} · {new Date(d.createdAt).toLocaleDateString()}{d.forwardedAt ? ` · passed on ${new Date(d.forwardedAt).toLocaleDateString()}` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS[d.status]?.[1] ?? ''}`}>{STATUS[d.status]?.[0] ?? d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!user && !donation && !error && <p className="text-center text-sm text-gray-600"><Link href="/login" className="text-brand-600 font-semibold">Sign in</Link> to see your donations.</p>}
        <p className="text-center"><Link href="/" className="text-sm font-semibold text-brand-600">← Back to Lyrtrip</Link></p>
      </div>
    </div>
  );
}
