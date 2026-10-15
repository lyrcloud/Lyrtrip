'use client';

import { useState } from 'react';
import { idTokenOrNull } from '@/lib/rewards';

export interface BookableRide {
  productId: string;
  name: string;
  emoji: string;
  seats: string;
  price: number;
  currency: string;
  pickupMinutes: number | null;
  distance: number | null;
  duration: number | null;
}

interface Stop { lat: number; lng: number; label: string }

const input = 'w-full px-3 py-2.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:border-gray-900';
const label = 'block text-xs font-medium text-gray-600 mb-1';
const fmt = (n: number, c: string) => {
  try { return n.toLocaleString(undefined, { style: 'currency', currency: c }); } catch { return `${c} ${n.toFixed(2)}`; }
};

// Books a ride on Lyrtrip: the card is held, and the final fare + 10% is charged when the ride ends
export default function RideBooking({ ride, pickup, dropoff, user, onClose }: {
  ride: BookableRide; pickup: Stop; dropoff: Stop; user: { email?: string; name?: string } | null; onClose: () => void;
}) {
  const [first, ...rest] = (user?.name ?? '').split(' ');
  const [guest, setGuest] = useState({ firstName: first ?? '', lastName: rest.join(' '), phone: '', email: user?.email ?? '' });
  const [note, setNote] = useState('');
  const [price, setPrice] = useState(ride.price);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof guest, v: string) => { setGuest(g => ({ ...g, [k]: v })); setError(null); };
  const hold = Math.max(price * 1.25, price + 5);

  const book = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
      const res = await fetch(`${base}/api/ride/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup, dropoff, productId: ride.productId, quotedTotal: price, guest, note, idToken: await idTokenOrNull() }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) { window.location.href = data.url; return; }
      if (data.priceChanged && data.totalPrice) setPrice(data.totalPrice);
      setError(data.error ?? 'Could not start the booking. Please try again.');
    } catch {
      setError('Could not reach Lyrtrip. Check your connection and try again.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-900">Book a ride</h2>
          <span className="ml-auto text-2xl">{ride.emoji}</span>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-700 space-y-1">
          <p><span className="font-semibold">{ride.name}</span> · {ride.seats} seats{ride.pickupMinutes != null ? ` · pickup in ~${ride.pickupMinutes} min` : ''}</p>
          <p>📍 <span className="font-medium">From:</span> {pickup.label}</p>
          <p>🏁 <span className="font-medium">To:</span> {dropoff.label}</p>
          {ride.distance != null && <p>🛣️ {ride.distance.toFixed(1)} mi{ride.duration ? ` · ~${Math.round(ride.duration / 60)} min` : ''}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className={label}>Rider first name</label><input className={input} value={guest.firstName} onChange={e => set('firstName', e.target.value)} autoComplete="given-name" /></div>
          <div><label className={label}>Last name</label><input className={input} value={guest.lastName} onChange={e => set('lastName', e.target.value)} autoComplete="family-name" /></div>
          <div className="col-span-2">
            <label className={label}>Rider&apos;s mobile (the driver may call or text)</label>
            <input className={input} type="tel" value={guest.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 415 555 2671" autoComplete="tel" />
          </div>
          <div className="col-span-2"><label className={label}>Email for the receipt</label><input className={input} type="email" value={guest.email} onChange={e => set('email', e.target.value)} autoComplete="email" /></div>
          <div className="col-span-2"><label className={label}>Note for the driver (optional)</label><input className={input} value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="e.g. Terminal 4, door 6" /></div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Estimated total</span><span>{fmt(price, ride.currency)}</span>
          </div>
          <p className="text-xs text-gray-500">
            Includes the Lyrtrip service fee. We hold {fmt(hold, ride.currency)} on your card and charge only the final fare
            (tolls or route changes can move it) when the ride ends. The rest of the hold is released. Cancel free before your ride starts.
          </p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition">Cancel</button>
          <button onClick={book} disabled={loading}
            className="flex-1 py-2.5 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 disabled:bg-gray-300 transition">
            {loading ? 'Starting…' : `Hold ${fmt(hold, ride.currency)} & book`}
          </button>
        </div>
      </div>
    </div>
  );
}
