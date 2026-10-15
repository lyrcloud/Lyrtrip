import { getSession } from '@/lib/auth';

export interface DonationCause { id: string; label: string; icon: string }
export interface Charity { id: string; name: string; causes: string[]; regions: string; about: string; zakat: boolean }
export interface CharityCatalog { causes: DonationCause[]; charities: Charity[]; giftTypes: string[]; serviceRate: number; min: number; max: number }

export interface Donation {
  id: string; charity: string; cause: string; giftType: string; amount: number; service: number; total: number;
  status: 'paid' | 'forwarded' | 'refunded'; dedication: string; createdAt: string; paidAt: string | null; forwardedAt: string | null;
}

// Calls the donations API, signed in when there is a session (optional). Throws with the server's message.
export async function donationsCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/donations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
