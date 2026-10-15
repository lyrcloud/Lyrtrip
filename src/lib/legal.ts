import { getSession } from '@/lib/auth';

export type LegalService = 'tax' | 'legal' | 'lawyer';
export type LegalStatus = 'submitted' | 'info_needed' | 'quoted' | 'processing' | 'in_progress' | 'completed' | 'unavailable' | 'refunded' | 'cancelled';

export interface LegalContact { name: string; email: string; phone: string; country: string }

// What the customer fills in (and corrects when Lyrtrip asks for more details)
export interface LegalDraft {
  service: LegalService; category: string; jurisdiction: string; region: string; description: string; deadline: string; taxYear: string;
  forBusiness: boolean; businessName: string; meeting: string; urgency: string; language: string; otherParty: string;
  contact: LegalContact; budget: string;
}

// A tax, legal or lawyer request made through Lyrtrip
export interface LegalRequest extends Omit<LegalDraft, 'budget'> {
  id: string; serviceLabel: string; categoryLabel: string; budget: number | null;
  status: LegalStatus; statusLabel: string; message: string;
  // direct: the professional's fee (amount) is paid to them, and total is only Lyrtrip's booking fee
  quote: { amount: number; service: number; total: number; direct: boolean; details: string; expiresAt: string; paidAt: string | null } | null;
  createdAt: string; updatedAt: string;
}

export interface LegalServiceSpec { label: string; categories: Record<string, string> }
export interface LegalOptions { services: Record<LegalService, LegalServiceSpec>; meeting: string[]; urgency: string[]; serviceRate: number; quoteHours: number }

// Lawyers and legal services: the customer pays the professional directly and Lyrtrip only a booking fee
export const LEGAL_DIRECT: string[] = ['lawyer', 'legal'];

export const LEGAL_ICON: Record<string, string> = { tax: '🧾', legal: '📜', lawyer: '👩‍⚖️' };

export const LEGAL_STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-100 text-sky-800', info_needed: 'bg-orange-100 text-orange-800', quoted: 'bg-amber-100 text-amber-900',
  processing: 'bg-indigo-100 text-indigo-800', in_progress: 'bg-violet-100 text-violet-800', completed: 'bg-emerald-100 text-emerald-800',
  unavailable: 'bg-gray-200 text-gray-700', refunded: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-100 text-gray-500',
};

export const legalDraftFrom = (r: LegalRequest): LegalDraft => ({
  service: r.service, category: r.category, jurisdiction: r.jurisdiction, region: r.region, description: r.description, deadline: r.deadline,
  taxYear: r.taxYear, forBusiness: r.forBusiness, businessName: r.businessName, meeting: r.meeting, urgency: r.urgency, language: r.language,
  otherParty: r.otherParty, contact: r.contact, budget: r.budget == null ? '' : String(r.budget),
});

// Calls the tax & legal API, signed in when there is a session. Throws with the server's message.
export async function legalCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/legal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
