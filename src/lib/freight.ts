import { getSession } from '@/lib/auth';

export type FreightMode = 'truck' | 'freight';
export type FreightStatus = 'submitted' | 'info_needed' | 'quoted' | 'processing' | 'booked' | 'in_transit' | 'delivered' | 'unavailable' | 'refunded' | 'cancelled';

export interface FreightContact { name: string; email: string; phone: string; country: string; company: string }
export interface FreightCargo { description: string; type: string; weightKg: string; volumeCbm: string; pieces: string; packaging: string; dimensions: string; value: string; unNumber: string }

// What the customer fills in (and corrects when Lyrtrip asks for more details)
export interface FreightDraft {
  mode: FreightMode; category: string; from: string; to: string; readyDate: string; flexibleDates: boolean;
  cargo: FreightCargo; containers: { type: string; count: string }; incoterm: string; customs: boolean; insurance: boolean; loadingHelp: boolean;
  contact: FreightContact; budget: string; note: string;
}

// A truck or cargo shipment requested through Lyrtrip
export interface FreightRequest {
  id: string; mode: FreightMode; modeLabel: string; category: string; categoryLabel: string; from: string; to: string; readyDate: string; flexibleDates: boolean;
  cargo: { description: string; type: string; weightKg: number | null; volumeCbm: number | null; pieces: number; packaging: string; dimensions: string; value: number | null; unNumber: string };
  containers: { type: string; count: number } | null; incoterm: string; customs: boolean; insurance: boolean; loadingHelp: boolean;
  contact: FreightContact; budget: number | null; note: string;
  status: FreightStatus; statusLabel: string; message: string;
  quote: { amount: number; service: number; total: number; details: string; expiresAt: string; paidAt: string | null } | null;
  createdAt: string; updatedAt: string;
}

export interface FreightModeSpec { label: string; international: boolean; categories: Record<string, string> }
export interface FreightOptions {
  modes: Record<FreightMode, FreightModeSpec>; cargoTypes: string[]; packaging: string[]; containers: string[]; incoterms: string[];
  serviceRate: number; quoteHours: number;
}

export const FREIGHT_ICON: Record<string, string> = { truck: '🚚', freight: '🚢' };

export const FREIGHT_STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-sky-100 text-sky-800', info_needed: 'bg-orange-100 text-orange-800', quoted: 'bg-amber-100 text-amber-900',
  processing: 'bg-indigo-100 text-indigo-800', booked: 'bg-emerald-100 text-emerald-800', in_transit: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800', unavailable: 'bg-gray-200 text-gray-700', refunded: 'bg-gray-200 text-gray-700', cancelled: 'bg-gray-100 text-gray-500',
};

const str = (n: number | null | undefined) => (n == null || n === 0 ? '' : String(n));

export const freightDraftFrom = (r: FreightRequest): FreightDraft => ({
  mode: r.mode, category: r.category, from: r.from, to: r.to, readyDate: r.readyDate, flexibleDates: r.flexibleDates,
  cargo: { ...r.cargo, weightKg: str(r.cargo.weightKg), volumeCbm: str(r.cargo.volumeCbm), pieces: str(r.cargo.pieces), value: str(r.cargo.value) },
  containers: { type: r.containers?.type ?? '', count: r.containers ? String(r.containers.count) : '1' },
  incoterm: r.incoterm, customs: r.customs, insurance: r.insurance, loadingHelp: r.loadingHelp,
  contact: r.contact, budget: str(r.budget), note: r.note,
});

// Calls the freight API (truck booking, cargo and containers), signed in when there is a session. Throws with the server's message.
export async function freightCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/freight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
