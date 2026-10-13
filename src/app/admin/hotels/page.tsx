'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getSession } from '@/lib/auth';

interface HotelRequest {
  status: 'requested' | 'confirmed' | 'declined';
  requestRef: string;
  hotel: { name: string; address?: string; phone?: string; link?: string };
  checkin: string;
  checkout: string;
  nights: number;
  adults: number;
  roomPreference?: string;
  specialRequests?: string;
  guest: { givenName: string; familyName: string; email: string; phone: string };
  hotelTotal: number;
  hotelNightly?: number;
  serviceFee: number;
  totalPrice: number;
  requestedAt?: string;
  hotelConfirmation?: string | null;
  declineReason?: string | null;
  adminNote?: string | null;
}

const STATUS_STYLE = {
  requested: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  declined:  'bg-gray-200 text-gray-700',
};

export default function HotelAdminPage() {
  const [rows, setRows]       = useState<HotelRequest[] | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<'requested' | 'all'>('requested');
  const [busy, setBusy]       = useState<string | null>(null);
  const [inputs, setInputs]   = useState<Record<string, { conf: string; note: string; reason: string }>>({});

  const call = useCallback(async (payload: Record<string, unknown>) => {
    const session = await getSession();
    if (!session?.idToken) throw new Error('Please sign in with your admin account.');
    const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
    const res  = await fetch(`${baseUrl}/api/hotel/admin`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...payload, idToken: session.idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data;
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await call({ action: 'list' });
      setRows(data.bookings);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load requests');
    }
  }, [call]);

  useEffect(() => { void load(); }, [load]);

  const field = (id: string) => inputs[id] ?? { conf: '', note: '', reason: '' };
  const setField = (id: string, k: 'conf' | 'note' | 'reason', v: string) =>
    setInputs(prev => ({ ...prev, [id]: { ...field(id), [k]: v } }));

  const act = async (r: HotelRequest, action: 'confirm' | 'decline') => {
    const f = field(r.requestRef);
    if (action === 'decline' && !window.confirm(`Refund $${r.totalPrice.toFixed(2)} to ${r.guest.givenName} ${r.guest.familyName} and decline this request?`)) return;
    setBusy(r.requestRef);
    try {
      await call(action === 'confirm'
        ? { action, id: r.requestRef, hotelConfirmation: f.conf, note: f.note }
        : { action, id: r.requestRef, reason: f.reason });
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const shown = (rows ?? []).filter(r => filter === 'all' || r.status === 'requested');
  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <div className="flex-1 bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hotel booking requests</h1>
          <div className="flex gap-2">
            {(['requested', 'all'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f ? 'bg-btn text-white' : 'bg-white border border-gray-300 text-gray-700'}`}>
                {f === 'requested' ? 'To book' : 'All'}
              </button>
            ))}
            <button onClick={load} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700">Refresh</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">
            {error} <Link href="/login" className="underline font-semibold">Sign in</Link>
          </div>
        )}
        {!error && rows === null && <p className="text-gray-500">Loading…</p>}
        {rows && shown.length === 0 && <p className="text-gray-500">{filter === 'requested' ? 'Nothing waiting to be booked.' : 'No requests yet.'}</p>}

        <div className="space-y-4">
          {shown.map(r => (
            <div key={r.requestRef} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  <h2 className="text-lg font-bold text-gray-900 mt-1">{r.hotel.name}</h2>
                  <p className="text-sm text-gray-600">{r.hotel.address}</p>
                  <p className="text-sm text-gray-600">
                    {r.hotel.phone && <a href={`tel:${r.hotel.phone}`} className="text-brand-600 hover:underline mr-3">{r.hotel.phone}</a>}
                    {r.hotel.link && <a href={r.hotel.link} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Hotel website ↗</a>}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-500">Customer paid</p>
                  <p className="text-xl font-bold text-gray-900">${r.totalPrice.toFixed(2)}</p>
                  <p className="text-gray-500">Book for up to <span className="font-semibold text-gray-900">${r.hotelTotal.toFixed(2)}</span></p>
                  <p className="text-xs text-gray-400">your fee ${r.serviceFee.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                <div><p className="text-xs text-gray-500">Dates</p><p className="font-semibold">{r.checkin} → {r.checkout}</p><p className="text-xs text-gray-500">{r.nights} night{r.nights !== 1 ? 's' : ''}</p></div>
                <div><p className="text-xs text-gray-500">Guests</p><p className="font-semibold">{r.adults} adult{r.adults !== 1 ? 's' : ''}</p></div>
                <div className="col-span-2"><p className="text-xs text-gray-500">Guest</p><p className="font-semibold">{r.guest.givenName} {r.guest.familyName}</p>
                  <p className="text-xs"><a href={`mailto:${r.guest.email}`} className="text-brand-600">{r.guest.email}</a> · {r.guest.phone}</p></div>
                {r.roomPreference && <div className="col-span-2"><p className="text-xs text-gray-500">Room preference</p><p>{r.roomPreference}</p></div>}
                {r.specialRequests && <div className="col-span-2"><p className="text-xs text-gray-500">Special requests</p><p>{r.specialRequests}</p></div>}
              </div>
              <p className="text-xs text-gray-400 mt-3">Ref {r.requestRef}{r.requestedAt ? ` · requested ${new Date(r.requestedAt).toLocaleString()}` : ''}</p>

              {r.status === 'confirmed' && <p className="mt-3 text-sm text-green-800">Hotel confirmation: <span className="font-mono font-bold">{r.hotelConfirmation}</span>{r.adminNote ? ` · ${r.adminNote}` : ''}</p>}
              {r.status === 'declined' && <p className="mt-3 text-sm text-gray-700">Declined and refunded: {r.declineReason}</p>}

              {r.status === 'requested' && (
                <div className="grid sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-900">Booked it with the hotel?</p>
                    <input value={field(r.requestRef).conf} onChange={e => setField(r.requestRef, 'conf', e.target.value)} placeholder="Hotel confirmation number" className={input} />
                    <input value={field(r.requestRef).note} onChange={e => setField(r.requestRef, 'note', e.target.value)} placeholder="Internal note (optional)" className={input} />
                    <button onClick={() => act(r, 'confirm')} disabled={busy === r.requestRef || !field(r.requestRef).conf.trim()}
                      className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300">Confirm &amp; email guest</button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-900">Can&apos;t book it?</p>
                    <input value={field(r.requestRef).reason} onChange={e => setField(r.requestRef, 'reason', e.target.value)} placeholder="Reason shown to the guest" className={input} />
                    <button onClick={() => act(r, 'decline')} disabled={busy === r.requestRef}
                      className="w-full py-2 bg-white border border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 disabled:opacity-50">Decline &amp; refund in full</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
