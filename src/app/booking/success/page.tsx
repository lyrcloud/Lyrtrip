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

interface ItinerarySegment {
  direction?: string;
  carrier: string;
  flightNumber: string;
  operatingCarrier?: string | null;
  from: string;
  to: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  duration?: number | null;
  aircraft?: string | null;
  cabin?: string;
  bookingClass?: string | null;
  fareBasis?: string | null;
}

interface FlightConfirmation {
  pnr: string;
  airlineLocator?: string | null;
  tickets?: { number: string; passenger: string }[];
  itinerary?: ItinerarySegment[];
  issuedAt?: string;
  duffelOrderId?: string;
  bookingRef?: string;
  flightOrderId?: string;
  orderId?: string;
  totalPrice: number;
  basePrice?: number;
  currency: string;
  testBooking?: boolean;
  contact?: { email?: string; phone?: string };
  payment?: { brand?: string | null; last4?: string | null; paidAt?: string; receiptUrl?: string | null; reference?: string } | null;
  passengers: { title?: string; givenName: string; familyName: string; email: string }[];
  flightSummary?: { legs?: FlightLeg[]; from?: string; to?: string; depart?: string };
}

function fmtDate(d: string): string {
  if (!d) return '';
  const dt = new Date(`${d}T12:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtTicket(n?: string): string {
  if (!n) return '—';
  return /^\d{13}$/.test(n) ? `${n.slice(0, 3)}-${n.slice(3)}` : n;
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
      // Some airlines take longer to ticket than the API gateway waits (it answers 503/504), and a
      // refresh can arrive mid-booking (202). The booking carries on server-side, so keep asking.
      const MAX_ATTEMPTS = 45;  // ~4 minutes
      const confirm = async (attempt: number): Promise<void> => {
        let data: { success?: boolean; pending?: boolean; error?: string; message?: string } | null = null;
        let retry = false;
        try {
          const res = await fetch(`${baseUrl}/api/flight/confirm`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ sessionId }),
          });
          data = await res.json().catch(() => null);
          retry = res.status >= 502 || !!data?.pending || !data;
        } catch {
          retry = true;  // network hiccup
        }
        if (data?.success) { setFlightConfirm(data as unknown as FlightConfirmation); return; }
        if (retry && attempt < MAX_ATTEMPTS) {
          await new Promise(res => setTimeout(res, 5000));
          return confirm(attempt + 1);
        }
        setFlightError(retry
          ? 'Your ticket is taking longer than usual. We will email you when it is issued, or contact support@lyrtrip.com.'
          : data?.error ?? data?.message ?? 'Booking confirmation failed.');
      };
      confirm(0).finally(() => setFlightLoading(false));
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
          <p className="text-gray-500">We&apos;re confirming your booking with the airline. This usually takes a few seconds, but some airlines take up to a couple of minutes — please keep this page open.</p>
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

  // ── Flight — e-ticket & itinerary (printable) ─────────────────────────────
  if (flightConfirm) {
    const segments: ItinerarySegment[] = flightConfirm.itinerary?.length
      ? flightConfirm.itinerary
      : (flightConfirm.flightSummary?.legs ?? []).map(l => ({
          carrier: l.airline, flightNumber: l.flightNumber,
          from: l.departure?.airport, to: l.arrival?.airport,
          departureDate: (l.departure?.time ?? '').slice(0, 10), departureTime: (l.departure?.time ?? '').slice(11, 16),
          arrivalDate: (l.arrival?.time ?? '').slice(0, 10), arrivalTime: (l.arrival?.time ?? '').slice(11, 16),
        }));
    const tickets = flightConfirm.tickets ?? [];
    const p       = flightConfirm.payment;
    const money   = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const issued  = flightConfirm.issuedAt ? fmtDate(flightConfirm.issuedAt.slice(0, 10)) : fmtDate(new Date().toISOString().slice(0, 10));
    return (
      <div className="min-h-screen bg-gray-100 py-10 px-4 print:min-h-0 print:bg-white print:p-0">
        <div className="max-w-3xl mx-auto mb-4 flex gap-3 justify-end print:hidden">
          <button onClick={() => window.print()} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition">🖨 Print / Save as PDF</button>
          <Link href="/" className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition">Back to search</Link>
        </div>

        <article className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden print:shadow-none print:rounded-none">
          {flightConfirm.testBooking && (
            <div className="bg-red-600 text-white text-center font-black tracking-widest py-2 text-sm">
              TEST BOOKING — NOT VALID FOR TRAVEL
            </div>
          )}
          {/* Header */}
          <header className="flex items-center justify-between px-8 py-6 border-b-4 border-indigo-600">
            <img src="/logo.png" alt="Lyrtrip" className="h-12 w-auto" />
            <div className="text-right">
              <p className="text-xl font-black text-gray-900 tracking-wide">ELECTRONIC TICKET</p>
              <p className="text-xs text-gray-500">Passenger itinerary / receipt · Issued {issued}</p>
            </div>
          </header>

          {/* References */}
          <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 px-8 py-5 bg-indigo-50 print:bg-white print:border-b print:border-gray-200">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Booking reference (PNR)</p>
              <p className="text-2xl font-black text-indigo-700 tracking-[0.2em] font-mono">{flightConfirm.pnr}</p>
            </div>
            {flightConfirm.airlineLocator && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Airline reference</p>
                <p className="text-2xl font-black text-gray-900 tracking-[0.2em] font-mono">{flightConfirm.airlineLocator}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Lyrtrip order</p>
              <p className="text-sm font-mono text-gray-700 break-all mt-1">{flightConfirm.orderId ?? flightConfirm.flightOrderId ?? flightConfirm.bookingRef}</p>
            </div>
          </section>

          {/* Passengers & ticket numbers */}
          <section className="px-8 py-5 border-b border-gray-200">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Passengers</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] text-gray-500 uppercase tracking-widest">
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">E-ticket number</th>
                </tr>
              </thead>
              <tbody>
                {flightConfirm.passengers.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-2 font-semibold text-gray-900 uppercase">{p.familyName}/{p.givenName}{p.title ? ` ${p.title.toUpperCase()}` : ''}</td>
                    <td className="py-2 font-mono text-gray-900">{fmtTicket(tickets[i]?.number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Itinerary */}
          <section className="px-8 py-5 border-b border-gray-200">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Itinerary</h2>
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <div key={i} className="break-inside-avoid">
                {seg.direction && seg.direction !== segments[i - 1]?.direction && (
                  <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-1.5 mt-1">{seg.direction}</p>
                )}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="font-semibold text-gray-900">Flight {seg.flightNumber}{seg.operatingCarrier && seg.operatingCarrier !== seg.carrier ? ` · operated by ${seg.operatingCarrier}` : ''}</span>
                    <span>{[seg.cabin, seg.bookingClass && `Class ${seg.bookingClass}`, seg.aircraft && `Aircraft ${seg.aircraft}`].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-2xl font-black text-gray-900">{seg.from}</p>
                      <p className="text-sm font-semibold text-indigo-700">{seg.departureTime}</p>
                      <p className="text-xs text-gray-500">{fmtDate(seg.departureDate)}</p>
                    </div>
                    <div className="text-center text-gray-400 text-xs">
                      <p className="text-lg">✈</p>
                      {seg.duration ? <p>{Math.floor(seg.duration / 60)}h {seg.duration % 60}m</p> : null}
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-2xl font-black text-gray-900">{seg.to}</p>
                      <p className="text-sm font-semibold text-indigo-700">{seg.arrivalTime}</p>
                      <p className="text-xs text-gray-500">{fmtDate(seg.arrivalDate)}</p>
                    </div>
                  </div>
                  {seg.fareBasis && <p className="text-[10px] text-gray-400 mt-2">Fare basis {seg.fareBasis}</p>}
                </div>
                </div>
              ))}
            </div>
          </section>

          {/* Payment receipt */}
          <section className="px-8 py-5 border-b border-gray-200">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-widest mb-3">Payment receipt</h2>
            <table className="w-full text-sm">
              <tbody>
                {flightConfirm.basePrice != null && (
                  <>
                    <tr><td className="py-1 text-gray-600">Air fare, taxes &amp; carrier charges</td><td className="py-1 text-right font-mono">{money(flightConfirm.basePrice)}</td></tr>
                    <tr><td className="py-1 text-gray-600">Lyrtrip service fee</td><td className="py-1 text-right font-mono">{money(flightConfirm.totalPrice - flightConfirm.basePrice)}</td></tr>
                  </>
                )}
                <tr className="border-t border-gray-300">
                  <td className="pt-2 font-bold text-gray-900">Total paid</td>
                  <td className="pt-2 text-right text-xl font-black text-gray-900">{flightConfirm.currency} {money(flightConfirm.totalPrice)}</td>
                </tr>
              </tbody>
            </table>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 text-xs">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Paid with</p>
                <p className="font-semibold text-gray-900 capitalize">{p?.brand && p.last4 ? `${p.brand} •••• ${p.last4}` : 'Card'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Date paid</p>
                <p className="font-semibold text-gray-900">{p?.paidAt ? fmtDateTime(p.paidAt) : issued}</p>
              </div>
              {p?.reference && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Payment reference</p>
                  <p className="font-mono text-gray-900 break-all">{p.reference}</p>
                </div>
              )}
              {flightConfirm.contact?.email && (
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Billed to</p>
                  <p className="font-semibold text-gray-900 break-all">{flightConfirm.contact.email}{flightConfirm.contact.phone ? ` · ${flightConfirm.contact.phone}` : ''}</p>
                </div>
              )}
            </div>
            {p?.receiptUrl && (
              <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-xs text-indigo-600 hover:underline print:hidden">View card receipt from Stripe ↗</a>
            )}
          </section>

          {/* Notes */}
          <section className="px-8 py-5 text-xs text-gray-600 space-y-1">
            <p>• Check in online with the airline using your booking or airline reference. Online check-in usually opens 24 hours before departure.</p>
            <p>• Bring a valid passport or government photo ID matching the passenger name above.</p>
            <p>• Arrive at least 2 hours before domestic and 3 hours before international departures.</p>
            <p>• Baggage allowance and change/refund rules depend on your fare — check with the airline.</p>
            <p className="pt-2 text-gray-400">Issued by Lyrtrip · www.lyrtrip.com · support@lyrtrip.com</p>
          </section>
        </article>
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
