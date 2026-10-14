import type { Tour } from '@/types/database';
import { getAccessToken } from './auth';

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
  const token = getAccessToken();
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

