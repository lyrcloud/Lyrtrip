import { getSession } from '@/lib/auth';

export interface EventAttendee { fullName: string; dateOfBirth: string; nationality: string; idType: string; idNumber: string }
export interface EventContact { name: string; email: string; phone: string; country: string }

export type EventTicketStatus = 'submitted' | 'info_needed' | 'quoted' | 'processing' | 'ticketed' | 'unavailable' | 'refunded' | 'cancelled';

// A ticket request made through Lyrtrip; the organiser's and ticket sites' links stay with Lyrtrip
export interface EventTicketRequest {
  id: string;
  event: { name: string; when: string | null; startDate: string | null; venue: string | null; address: string };
  quantity: number; ticketType: string; seatTogether: boolean; maxPerTicket: number | null; eventDate: string;
  contact: EventContact; attendees: EventAttendee[]; accessibility: string; note: string;
  status: EventTicketStatus; statusLabel: string; message: string;
  quote: { amount: number; service: number; total: number; details: string; expiresAt: string; paidAt: string | null } | null;
  createdAt: string; updatedAt: string;
}

export interface EventTicketOptions { ticketTypes: string[]; idTypes: string[]; maxTickets: number; serviceRate: number; quoteHours: number }

export const EVENT_STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-100 text-sky-800', info_needed: 'bg-orange-100 text-orange-800', quoted: 'bg-amber-100 text-amber-900',
  processing: 'bg-indigo-100 text-indigo-800', ticketed: 'bg-emerald-100 text-emerald-800', unavailable: 'bg-gray-200 text-gray-700',
  refunded: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-100 text-gray-500',
};

export const NEW_ATTENDEE: EventAttendee = { fullName: '', dateOfBirth: '', nationality: '', idType: '', idNumber: '' };

// Calls the event tickets API, signed in when there is a session. Throws with the server's message.
export async function eventsCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
