// Tutte le date dell'app sono nel fuso di Roma. Una data e' una chiave YYYYMMDD,
// un orario HHMM; i calcoli fra date usano Date.UTC sui componenti di Roma, cosi'
// l'aritmetica dei giorni non dipende dal fuso del browser.

const romeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface RomeNow {
  y: number;
  m: number;
  d: number;
  hh: number;
  mi: number;
}

export function romeNow(): RomeNow {
  const parts = Object.fromEntries(
    romeFormatter.formatToParts(new Date(Date.now())).map((p) => [p.type, p.value]),
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: +parts.hour % 24, mi: +parts.minute };
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function dayKey(offset: number): string {
  const { y, m, d } = romeNow();
  const date = new Date(Date.UTC(y, m - 1, d + offset));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

export function shiftDay(key: string, days: number): string {
  const date = new Date(Date.UTC(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8) + days));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/** Offset del giorno rispetto a oggi (0..6), o null fuori dalla programmazione. */
export function offsetOf(key: string): number | null {
  for (let i = 0; i < 7; i++) if (dayKey(i) === key) return i;
  return null;
}

/** Minuti "locali di Roma" da un'origine fissa: servono solo per confronti. */
export function minutesOf(key: string, hhmm: string): number {
  return (
    Date.UTC(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8), +hhmm.slice(0, 2), +hhmm.slice(2, 4)) /
    60000
  );
}

export function nowMinutes(): number {
  const { y, m, d, hh, mi } = romeNow();
  return Date.UTC(y, m - 1, d, hh, mi) / 60000;
}

function utcDate(key: string): Date {
  return new Date(Date.UTC(+key.slice(0, 4), +key.slice(4, 6) - 1, +key.slice(6, 8)));
}

/** "giovedì 30 ottobre 2026" */
export function longDate(key: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(utcDate(key));
}

/** "ven 31 ott" */
export function shortDate(key: string): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
    .format(utcDate(key))
    .replace(/\./g, '');
}

export function dayTabLabel(offset: number): string {
  if (offset === 0) return 'Oggi';
  if (offset === 1) return 'Domani';
  return shortDate(dayKey(offset));
}

/** "2030" -> "20:30" */
export function clock(hhmm: string): string {
  return `${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`;
}
