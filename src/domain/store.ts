import type { TicketType, Totals, PaymentMethod } from './pricing';

// Tutto lo stato vive nel localStorage del browser: ogni contesto di Playwright
// parte vuoto, quindi i test non si sporcano a vicenda e non serve un reset.

export interface Order {
  showId: string;
  seats: string[];
  types: Record<string, TicketType>;
  promoCount: number;
}

export type BookingStatus = 'Confermata' | 'Da pagare in cassa' | 'Annullata';

export interface Booking {
  code: string;
  showId: string;
  seats: string[];
  types: Record<string, TicketType>;
  totals: Totals;
  paid: number;
  method: PaymentMethod;
  status: BookingStatus;
  email: string;
  name: string;
  createdAt: number;
}

const KEYS = { order: 'vz.order', bookings: 'vz.bookings', gift: 'vz.giftBalances' };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage non disponibile: l'app continua senza persistenza */
  }
}

export function loadOrder(): Order | null {
  return read<Order | null>(KEYS.order, null);
}

export function saveOrder(order: Order | null): void {
  write(KEYS.order, order);
  window.dispatchEvent(new Event('vz:order'));
}

export function loadBookings(): Booking[] {
  return read<Booking[]>(KEYS.bookings, []);
}

export function saveBookings(bookings: Booking[]): void {
  write(KEYS.bookings, bookings);
}

export function addBooking(booking: Booking): void {
  saveBookings([...loadBookings(), booking]);
}

export function giftBalances(): Record<string, number> {
  return read<Record<string, number>>(KEYS.gift, {});
}

export function saveGiftBalance(code: string, cents: number): void {
  write(KEYS.gift, { ...giftBalances(), [code]: cents });
}

export function newBookingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `VZ-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}
