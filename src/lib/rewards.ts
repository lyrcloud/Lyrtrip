import { getSession } from '@/lib/auth';

const REF_KEY = 'lyrtrip_ref';
const REF_DAYS = 30;

// Calls the rewards API, signed in when there is a session. Throws with the server's message.
export async function rewardsCall<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  const session = await getSession();
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const res = await fetch(`${baseUrl}/api/rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, ...(session?.idToken && { idToken: session.idToken }) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export async function idTokenOrNull() {
  return (await getSession())?.idToken ?? null;
}

// An affiliate link (?ref=CODE) is remembered for 30 days, and sent with the next booking.
export function captureReferral() {
  try {
    const code = new URLSearchParams(window.location.search).get('ref');
    if (code) localStorage.setItem(REF_KEY, JSON.stringify({ code: code.slice(0, 40), at: Date.now() }));
  } catch {
    // storage unavailable
  }
}

export function getReferral(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(REF_KEY) ?? 'null');
    return saved && Date.now() - saved.at < REF_DAYS * 864e5 ? saved.code : null;
  } catch {
    return null;
  }
}

export interface CheckoutExtrasValue {
  couponCode: string;
  giftCardCode: string;
  usePoints: boolean;
}

export interface RewardsQuote {
  total: number;
  coupon: number;
  giftCard: number;
  points: number;
  pointsValue: number;
  amountDue: number;
  listedTotal: number;
  businessSavings: number;
  buyerType: 'consumer' | 'business';
  company?: string;
  pointsAvailable: number;
  pointsEarned: number;
  couponInfo: { code: string; description: string } | null;
  giftCardInfo: { code: string; balance: number; remainingAfter: number } | null;
  errors: Partial<Record<'coupon' | 'giftCard' | 'points' | 'general', string>>;
}

export interface BookingCredits {
  total: number;
  amountPaid: number;
  coupon: number;
  couponCode: string | null;
  giftCard: number;
  points: number;
  pointsValue: number;
  buyerType: 'consumer' | 'business';
  company: string | null;
  retailTotal: number;
  pointsEarned: number | null;
}
