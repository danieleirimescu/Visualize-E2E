// Testi e test id che le release di sola modifica (C01, C02) cambiano.

export function tid(name: string): string {
  if (!__BUG_C01__) return name;
  if (name.startsWith('seat-')) return `posto-${name.slice(5)}`;
  if (name === 'seats-continue') return 'seats-next';
  if (name === 'tickets-continue') return 'tickets-next';
  return name;
}

export const LABELS = {
  proceed: __BUG_C02__ ? 'Continua' : 'Prosegui',
  pay: __BUG_C02__ ? 'Conferma e paga' : 'Paga ora',
  applyPromo: __BUG_C02__ ? 'Usa codice' : 'Applica',
};
