import type { Show } from './films';
import type { Order } from './store';
import { isVip, sortSeats } from './seats';

export type TicketType = 'intero' | 'ridotto' | 'bambini' | 'studente';
export type PaymentMethod = 'card' | 'gift' | 'cassa';

export const TICKET_LABELS: Record<TicketType, string> = {
  intero: 'Intero',
  ridotto: 'Ridotto Over 65',
  bambini: 'Bambini (sotto i 14 anni)',
  studente: 'Studente',
};

// Prezzi in centesimi.
export const TARIFFS: Record<TicketType, number> = { intero: 950, ridotto: 700, bambini: 600, studente: 750 };
export const SURCHARGE_3D = 200;
export const SURCHARGE_VIP = 300;
export const SERVICE_FEE = 80;
export const PROMO_CODE = 'VISUALIZE15';
export const PROMO_PERCENT = 15;
export const CASSA_MAX_TICKETS = 4;

export function availableTypes(show: Show): TicketType[] {
  const all: TicketType[] = ['intero', 'ridotto', 'bambini', 'studente'];
  if (show.filmData.rating === 'VM14' && !__BUG_B09__) return all.filter((t) => t !== 'bambini');
  return all;
}

function tariff(type: TicketType): number {
  if (type === 'ridotto' && __BUG_B01__) return TARIFFS.intero;
  if (type === 'studente' && __BUG_B04__) return (TARIFFS as Record<string, number>)['student'];
  return TARIFFS[type];
}

export interface Line {
  seat: string;
  type: TicketType;
  tariff: number;
  surcharge3d: number;
  surchargeVip: number;
  price: number;
}

export interface Totals {
  count: number;
  lines: Line[];
  tickets: number;
  supplements: number;
  fee: number;
  discount: number;
  total: number;
}

export function lineFor(seat: string, type: TicketType, show: Show): Line {
  const t = tariff(type);
  const s3d = show.format === '3D' ? SURCHARGE_3D : 0;
  const vip = isVip(seat) && !__BUG_B12__ ? SURCHARGE_VIP : 0;
  return { seat, type, tariff: t, surcharge3d: s3d, surchargeVip: vip, price: t + s3d + vip };
}

export function computeTotals(order: Order, show: Show, method: PaymentMethod = 'card'): Totals {
  const lines = sortSeats(order.seats).map((seat) => lineFor(seat, order.types[seat] ?? 'intero', show));
  const count = lines.length;
  const tickets = lines.reduce((sum, l) => sum + l.tariff, 0);
  const supplements = __BUG_B02__
    ? lines.reduce((sum, l) => sum + l.surchargeVip, 0)
    : lines.reduce((sum, l) => sum + l.surcharge3d + l.surchargeVip, 0);

  let fee = count * SERVICE_FEE;
  if (__BUG_B03__ && count > 0) fee = SERVICE_FEE;
  if (method === 'cassa' && !__BUG_B10__) fee = 0;

  let discount = 0;
  if (order.promoCount > 0) {
    const base = __BUG_B07__ ? tickets + supplements + fee : tickets + supplements;
    if (__BUG_B27__) {
      discount = lines.reduce((sum, l) => sum + Math.floor((l.price * PROMO_PERCENT) / 100), 0);
    } else {
      discount = Math.round((base * PROMO_PERCENT) / 100);
    }
    if (__BUG_B06__) discount *= order.promoCount;
  }

  return { count, lines, tickets, supplements, fee, discount, total: tickets + supplements + fee - discount };
}

export function cassaAvailable(count: number): boolean {
  return count <= (__BUG_B11__ ? 6 : CASSA_MAX_TICKETS);
}
