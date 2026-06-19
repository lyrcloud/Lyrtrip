export interface Booking {
  id: string;
  hotelName: string;
  address: string;
  checkin: string;
  checkout: string;
  guests: number;
  guestName: string;
  priceLevel?: string;
  pricePerNight: number;
  nights: number;
  totalPrice: number;
  status: 'pending_payment' | 'paid' | 'cancelled';
  createdAt: string;
}

const KEY = 'lyrtrip_bookings';

export function getBookings(): Booking[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'status'>): Booking {
  const newBooking: Booking = {
    ...booking,
    id: Date.now().toString(),
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
  };
  const existing = getBookings();
  localStorage.setItem(KEY, JSON.stringify([newBooking, ...existing]));
  return newBooking;
}

export function updateBookingStatus(id: string, status: Booking['status']): void {
  const bookings = getBookings().map(b => b.id === id ? { ...b, status } : b);
  localStorage.setItem(KEY, JSON.stringify(bookings));
}

export function cancelBooking(id: string): void {
  updateBookingStatus(id, 'cancelled');
}

export function calcNights(checkin: string, checkout: string): number {
  if (!checkin || !checkout) return 1;
  const nights = Math.round(
    (new Date(checkout).getTime() - new Date(checkin).getTime()) / 86_400_000
  );
  return nights > 0 ? nights : 1;
}

export const PRICE_PER_NIGHT: Record<string, number> = {
  'Free': 0,
  '$':    89,
  '$$':   160,
  '$$$':  300,
  '$$$$': 500,
};
