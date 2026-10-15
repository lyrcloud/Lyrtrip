import { getSession } from '@/lib/auth';

export interface TourField {
  id: string; label: string; type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox' | 'multi';
  options?: string[]; required?: boolean; min?: number; max?: number;
}
export interface TourDocType { id: string; label: string }
export interface TourSpec {
  category: string; sub: string | null; label: string; trip: boolean; passport: boolean; fixedDestination: string | null;
  fields: TourField[]; requiredDocs: TourDocType[]; optionalDocs: TourDocType[];
}
export interface TourOptions { hotels: string[]; rooms: string[]; meals: string[] }

export interface TourTraveller { fullName: string; dateOfBirth: string; gender: string; nationality: string; idType: string; idNumber: string; idExpiry: string }
export interface TourTrip {
  from: string; destination: string; startDate: string; nights: number | ''; flexibleDays: number | '';
  hotel: string; rooms: string; meals: string; flights: boolean; budgetPerPerson: number | '' | null;
}
export interface TourContact { name: string; email: string; phone: string; country: string }
export type TourExtras = Record<string, string | number | boolean | string[] | null>;
export interface TourUploadedDoc { kind: string; key: string; name: string }

export type TourStatus = 'submitted' | 'info_needed' | 'quoted' | 'processing' | 'confirmed' | 'unavailable' | 'refunded' | 'cancelled';

// A request made through Lyrtrip; the agencies' and official sites' links stay with Lyrtrip
export interface TourRequest {
  id: string; category: string; sub: string | null; label: string;
  item: { name: string; placeType: string | null; address: string };
  contact: TourContact; trip: TourTrip | null; travellers: TourTraveller[]; extras: TourExtras; specialNeeds: string; note: string;
  docs: { kind: string; name: string; label: string }[];
  status: TourStatus; statusLabel: string; message: string;
  quote: { amount: number; service: number; total: number; details: string; expiresAt: string; paidAt: string | null } | null;
  createdAt: string; updatedAt: string;
}

export const TOUR_STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-100 text-sky-800', info_needed: 'bg-orange-100 text-orange-800', quoted: 'bg-amber-100 text-amber-900',
  processing: 'bg-indigo-100 text-indigo-800', confirmed: 'bg-emerald-100 text-emerald-800', unavailable: 'bg-gray-200 text-gray-700',
  refunded: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-100 text-gray-500',
};

export const NEW_TRAVELLER: TourTraveller = { fullName: '', dateOfBirth: '', gender: '', nationality: '', idType: '', idNumber: '', idExpiry: '' };
export const DOC_ACCEPT = '.pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Calls the tour requests API, signed in when there is a session. Throws with the server's message.
export async function toursCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Uploads one document copy straight to private storage with a signed form; the request carries the key
export async function uploadTourDoc(kind: string, file: File): Promise<TourUploadedDoc> {
  const start = await toursCall<{ url: string; fields: Record<string, string>; key: string }>({ action: 'upload.start', kind, contentType: file.type, size: file.size });
  const form = new FormData();
  Object.entries(start.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file);
  const res = await fetch(start.url, { method: 'POST', body: form });
  if (!res.ok) throw new Error('The upload failed. Please try again.');
  return { kind, key: start.key, name: file.name };
}
