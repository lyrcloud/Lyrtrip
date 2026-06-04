import type { Tour } from '@/types/database';
import { getAccessToken } from './auth';

type CreateTourInput = Omit<Tour, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = await response.json();

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
