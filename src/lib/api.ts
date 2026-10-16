import type { Tour } from '@/types/database';
import { getAccessToken, getSession } from './auth';

type CreateTourInput = Omit<Tour, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export interface HotelResult {
  id: string;
  name: string;
  description: string;
  rating?: number;
  price?: number;
  currency?: string;
  unit?: string;
  roomType?: string;
  bedType?: string;
}

export interface HotelSearchParams {
  destinationLocation: { lat: number; lng: number };
  checkin?: string;
  checkout?: string;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // The site is a static export, so /api/* lives on the Lambda API, not this origin.
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  const token = (await getSession())?.accessToken ?? getAccessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = await response.json().catch(() => {
    throw new Error(`API request failed (${response.status})`);
  });

  if (!response.ok) {
    throw new Error(body.error || 'API request failed');
  }

  return body as T;
}

export async function createTour(tour: CreateTourInput) {
  return apiFetch<{ success: boolean; tour: Tour }>('/api/tours', {
    method: 'POST',
    body: JSON.stringify(tour),
  });
}

export async function listTours() {
  return apiFetch<{ success: boolean; tours: Tour[] }>('/api/tours');
}

export async function searchHotels(params: HotelSearchParams): Promise<HotelResult[]> {
  const res = await apiFetch<{ success: boolean; results: HotelResult[] }>('/api/search', {
    method: 'POST',
    body: JSON.stringify({ service: 'hotels', ...params }),
  });
  return res.results;
}

/**
 * The signed-in user's admin role, or null for regular users. Admin calls send
 * the ID token in the body because the API's CORS only allows content-type.
 */
export async function getAdminRole(): Promise<'superadmin' | 'admin' | null> {
  const session = await getSession();
  if (!session?.idToken) return null;
  const baseUrl = (process.env.NEXT_PUBLIC_SEARCH_LAMBDA_URL ?? '').replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/api/admin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'me', idToken: session.idToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.role === 'superadmin' || data.role === 'admin' ? data.role : null;
  } catch {
    return null;
  }
}
