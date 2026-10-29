import type { Show } from './films';
import { loadBookings } from './store';

export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const SEATS_PER_ROW = 10;
export const VIP_ROW = 'H';
export const MAX_SEATS = 8;

export function seatIds(): string[] {
  return ROWS.flatMap((r) => Array.from({ length: SEATS_PER_ROW }, (_, i) => `${r}${i + 1}`));
}

export function isVip(seat: string): boolean {
  return seat.startsWith(VIP_ROW);
}

export function compareSeats(a: string, b: string): number {
  return a[0] === b[0] ? +a.slice(1) - +b.slice(1) : a.localeCompare(b);
}

export function sortSeats(seats: Iterable<string>): string[] {
  return [...seats].sort(compareSeats);
}

const ALWAYS_TAKEN = new Set(['E4', 'E5', 'E6', 'E7']);
const ALWAYS_FREE_ROWS = new Set(['A', 'B']);

// Occupazione deterministica: dipende da film e orario, non dalla data, cosi'
// lo stesso spettacolo ha la stessa sala piena ogni giorno.
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function occupiedSeats(show: Show): Set<string> {
  if (show.soldOut) return new Set(seatIds());
  const taken = new Set<string>();
  for (const seat of seatIds()) {
    if (ALWAYS_TAKEN.has(seat)) taken.add(seat);
    else if (!ALWAYS_FREE_ROWS.has(seat[0]) && hash(`${show.film}|${show.time}|${seat}`) % 100 < 26) taken.add(seat);
  }
  if (!__BUG_B18__) {
    for (const booking of loadBookings()) {
      if (booking.showId !== show.id) continue;
      if (booking.status === 'Annullata' && !__BUG_B21__) continue;
      booking.seats.forEach((s) => taken.add(s));
    }
  }
  return taken;
}

/**
 * Posti liberi che la selezione lascerebbe isolati: un posto libero con entrambi
 * i vicini della fila occupati o selezionati, e almeno uno dei due selezionato.
 */
export function isolatedSeats(selected: Set<string>, taken: Set<string>): string[] {
  const blocked = (s: string) => selected.has(s) || taken.has(s);
  const isolated: string[] = [];
  for (const row of ROWS) {
    for (let n = 2; n < SEATS_PER_ROW; n++) {
      const seat = `${row}${n}`;
      const left = `${row}${n - 1}`;
      const right = `${row}${n + 1}`;
      if (blocked(seat)) continue;
      if (blocked(left) && blocked(right) && (selected.has(left) || selected.has(right))) isolated.push(seat);
    }
  }
  return isolated;
}
