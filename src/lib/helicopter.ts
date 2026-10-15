import { getSession } from '@/lib/auth';

export interface HeliPassenger { fullName: string; dateOfBirth: string; nationality: string; weightKg: string; idType: string; idNumber: string }
export interface HeliContact { name: string; email: string; phone: string; country: string }

// Air ambulance only: the patient (passenger 1) and the care they need on board
export interface HeliMedical { condition: string; mobility: string; oxygen: boolean; escort: string; urgency: string; bedConfirmed: boolean; doctor: string; insurance: string }

export type HeliService = 'helicopter' | 'seaplane' | 'ambulance' | 'roadambulance';

// Services that carry a patient and ask for their medical needs
export const HELI_MEDICAL: string[] = ['ambulance', 'roadambulance'];

export type HeliStatus = 'submitted' | 'info_needed' | 'quoted' | 'processing' | 'confirmed' | 'unavailable' | 'refunded' | 'cancelled';

// What the customer fills in (and corrects when Lyrtrip asks for more details)
export interface HeliDraft {
  service: HeliService; medical: HeliMedical; charter: string; roundTrip: boolean; from: string; to: string; date: string; time: string; returnDate: string; returnTime: string;
  flexibleDates: boolean; hours: string; aircraft: string; contact: HeliContact; passengers: HeliPassenger[]; luggageKg: string; budget: string; note: string;
}

// An air charter or ambulance (helicopter, seaplane, air or ground ambulance) requested through Lyrtrip
export interface HeliRequest {
  id: string; service: HeliService; serviceLabel: string; medical: HeliMedical | null; charter: string; charterLabel: string; roundTrip: boolean; from: string; to: string;
  date: string; time: string; returnDate: string; returnTime: string; flexibleDates: boolean; hours: number | null; aircraft: string;
  contact: HeliContact; passengers: (Omit<HeliPassenger, 'weightKg'> & { weightKg: number })[]; luggageKg: number; budget: number | null; note: string;
  status: HeliStatus; statusLabel: string; message: string;
  quote: { amount: number; service: number; total: number; details: string; expiresAt: string; paidAt: string | null } | null;
  createdAt: string; updatedAt: string;
}

export interface HeliServiceSpec { label: string; charters: Record<string, string>; aircraft: string[]; loop: string[] }
export interface HeliOptions { services: Record<HeliService, HeliServiceSpec>; mobility: string[]; escorts: string[]; urgency: string[]; idTypes: string[]; maxPassengers: number; serviceRate: number; quoteHours: number }

export const HELI_ICON: Record<string, string> = { helicopter: '🚁', seaplane: '🛩️', ambulance: '🚑', roadambulance: '🚨' };

export const HELI_STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-100 text-sky-800', info_needed: 'bg-orange-100 text-orange-800', quoted: 'bg-amber-100 text-amber-900',
  processing: 'bg-indigo-100 text-indigo-800', confirmed: 'bg-emerald-100 text-emerald-800', unavailable: 'bg-gray-200 text-gray-700',
  refunded: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-100 text-gray-500',
};

export const NEW_MEDICAL: HeliMedical = { condition: '', mobility: '', oxygen: false, escort: '', urgency: '', bedConfirmed: false, doctor: '', insurance: '' };

export const NEW_PASSENGER: HeliPassenger = { fullName: '', dateOfBirth: '', nationality: '', weightKg: '', idType: '', idNumber: '' };

export const heliDraftFrom = (r: HeliRequest): HeliDraft => ({
  service: r.service, medical: r.medical ?? { ...NEW_MEDICAL },
  charter: r.charter, roundTrip: r.roundTrip, from: r.from, to: r.to, date: r.date, time: r.time, returnDate: r.returnDate, returnTime: r.returnTime,
  flexibleDates: r.flexibleDates, hours: r.hours == null ? '' : String(r.hours), aircraft: r.aircraft, contact: r.contact,
  passengers: r.passengers.map(p => ({ ...p, weightKg: String(p.weightKg) })), luggageKg: String(r.luggageKg || ''),
  budget: r.budget == null ? '' : String(r.budget), note: r.note,
});

// Calls the air charter API (helicopter, seaplane, air ambulance), signed in when there is a session. Throws with the server's message.
export async function heliCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/helicopter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
