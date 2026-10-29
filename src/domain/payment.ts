import { romeNow } from './time';
import { giftBalances } from './store';

export function digits(text: string): string {
  return text.replace(/\D/g, '');
}

export function isAmex(number: string): boolean {
  return /^3[47]/.test(digits(number));
}

export function luhn(number: string): boolean {
  const ds = digits(number);
  let sum = 0;
  for (let i = 0; i < ds.length; i++) {
    let d = +ds[ds.length - 1 - i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return ds.length > 0 && sum % 10 === 0;
}

/** Raggruppa le cifre mentre si scrive: 4-4-4-4, o 4-6-5 per American Express. */
export function formatCardNumber(text: string): string {
  const ds = digits(text).slice(0, isAmex(text) ? 15 : 16);
  if (isAmex(ds)) return [ds.slice(0, 4), ds.slice(4, 10), ds.slice(10, 15)].filter(Boolean).join(' ');
  return ds.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function cardNumberError(number: string): string | null {
  const ds = digits(number);
  if (!ds) return 'Campo obbligatorio.';
  const length = isAmex(ds) ? 15 : 16;
  if (ds.length !== length || !luhn(ds)) return 'Numero di carta non valido.';
  return null;
}

export function expiryError(text: string): string | null {
  const value = text.trim();
  if (!value) return 'Campo obbligatorio.';
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(value);
  if (!match) return 'Usa il formato MM/AA.';
  const month = +match[1];
  const year = 2000 + +match[2];
  const { y, m } = romeNow();
  const expired = __BUG_B25__ ? year < y || (year === y && month <= m) : year < y || (year === y && month < m);
  return expired ? 'La carta è scaduta.' : null;
}

export function cvvError(cvv: string, number: string): string | null {
  const value = cvv.trim();
  if (!value) return 'Campo obbligatorio.';
  const length = isAmex(number) && !__BUG_B26__ ? 4 : 3;
  return new RegExp(`^\\d{${length}}$`).test(value) ? null : 'Codice di sicurezza non valido.';
}

export type CardOutcome = 'approved' | 'declined' | 'insufficient' | '3ds';

export function cardOutcome(number: string): CardOutcome {
  switch (digits(number)) {
    case '4000000000000002':
      return 'declined';
    case '4000000000009995':
      return 'insufficient';
    case '4000000000003220':
      return '3ds';
    default:
      return 'approved';
  }
}

export const THREE_DS_CODE = '123456';

export const GIFT_FORMAT = /^GIFT-\d{4}-\d{4}-\d{4}$/;

const GIFT_CARDS: Record<string, { balance: number; expired?: boolean }> = {
  'GIFT-5000-0000-0001': { balance: 5000 },
  'GIFT-1000-0000-0002': { balance: 1000 },
  'GIFT-0000-0000-0003': { balance: 2000, expired: true },
};

export type GiftLookup =
  | { ok: true; code: string; balance: number }
  | { ok: false; message: string };

export function lookupGift(text: string): GiftLookup {
  const code = text.trim().toUpperCase();
  if (!GIFT_FORMAT.test(code)) return { ok: false, message: 'Formato del codice non valido.' };
  const card = GIFT_CARDS[code];
  if (!card) return { ok: false, message: 'Carta regalo inesistente.' };
  if (card.expired) return { ok: false, message: 'Carta regalo scaduta.' };
  const stored = giftBalances()[code];
  return { ok: true, code, balance: stored ?? card.balance };
}
