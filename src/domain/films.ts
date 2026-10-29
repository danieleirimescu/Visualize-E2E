import { dayKey, minutesOf, nowMinutes, offsetOf, longDate, clock } from './time';

export type Rating = 'T' | 'VM14';
export type Format = '2D' | '3D';

export interface Film {
  slug: string;
  title: string;
  genre: string;
  duration: number;
  rating: Rating;
  director: string;
  cast: string[];
  plot: string;
  accent: string;
}

export interface Slot {
  film: string;
  time: string; // HHMM
  hall: 1 | 2 | 3;
  format: Format;
  soldOut?: boolean;
}

export interface Show extends Slot {
  id: string;
  date: string; // YYYYMMDD
  filmData: Film;
}

// Gli slug non contengono cifre: per la pipeline un segmento di percorso con
// cifre e' un id di record, e su quelle pagine il controllo per pagina si astiene.
export const FILMS: Film[] = [
  {
    slug: 'il-faro-sommerso',
    title: 'Il faro sommerso',
    genre: 'Dramma',
    duration: 118,
    rating: 'T',
    director: 'Marta Lisi',
    cast: ['Giulia Fermi', 'Andrea Volta', 'Sara Conti'],
    plot: "Su un'isola che il mare sta lentamente inghiottendo, l'ultima guardiana del faro deve decidere se partire con gli altri abitanti o restare a tenere accesa la luce.",
    accent: '#3a7ca5',
  },
  {
    slug: 'luci-di-marte',
    title: 'Luci di Marte',
    genre: 'Fantascienza',
    duration: 131,
    rating: 'T',
    director: 'Paolo Ruggeri',
    cast: ['Elena Marchi', 'Tommaso Bel', 'Nadia Orsi'],
    plot: 'Una squadra di geologi scopre sotto la superficie di Marte una rete di cavità illuminate da una luce che nessuno strumento riesce a spiegare.',
    accent: '#c8553d',
  },
  {
    slug: 'la-citta-di-vetro',
    title: 'La città di vetro',
    genre: 'Thriller',
    duration: 104,
    rating: 'VM14',
    director: 'Irene Sala',
    cast: ['Luca Moro', 'Chiara Neri'],
    plot: "Un'ispettrice indaga su una serie di furti in un quartiere dove ogni facciata è trasparente e nessuno sembra aver visto niente.",
    accent: '#5b8e7d',
  },
  {
    slug: 'ultimo-treno-per-orione',
    title: 'Ultimo treno per Orione',
    genre: 'Avventura',
    duration: 126,
    rating: 'T',
    director: 'Davide Greco',
    cast: ['Marco Riva', 'Alice Fontana', 'Bruno Testa'],
    plot: "Due fratelli salgono per sbaglio sull'ultimo treno di una linea che, secondo la leggenda, attraversa le costellazioni.",
    accent: '#7b5ea7',
  },
  {
    slug: 'piccoli-giganti',
    title: 'Piccoli giganti',
    genre: 'Animazione',
    duration: 92,
    rating: 'T',
    director: 'Fabio Leone',
    cast: ['voci di Anna Gallo', 'Pietro Serra'],
    plot: 'In un bosco dove gli alberi sono alti come grattacieli, una formica e un riccio partono per riportare a casa un seme rubato.',
    accent: '#e0a458',
  },
  {
    slug: 'notte-a-ponente',
    title: 'Notte a Ponente',
    genre: 'Horror',
    duration: 99,
    rating: 'VM14',
    director: 'Silvia Romano',
    cast: ['Gianni Bassi', 'Laura Pace'],
    plot: "Un gruppo di amici affitta una villa sulla costa ligure fuori stagione. Ogni notte, alla stessa ora, il mare smette di fare rumore.",
    accent: '#4a4e69',
  },
];

// Programmazione fissa, uguale tutti i giorni.
export const SLOTS: Slot[] = [
  { film: 'piccoli-giganti', time: '1500', hall: 1, format: '2D' },
  { film: 'il-faro-sommerso', time: '1730', hall: 1, format: '2D' },
  { film: 'il-faro-sommerso', time: '2030', hall: 1, format: '2D' },
  { film: 'notte-a-ponente', time: '2250', hall: 1, format: '2D' },
  { film: 'ultimo-treno-per-orione', time: '1500', hall: 2, format: '2D' },
  { film: 'luci-di-marte', time: '1745', hall: 2, format: '3D' },
  { film: 'luci-di-marte', time: '2030', hall: 2, format: '3D' },
  { film: 'ultimo-treno-per-orione', time: '2250', hall: 2, format: '3D' },
  { film: 'piccoli-giganti', time: '1600', hall: 3, format: '2D', soldOut: true },
  { film: 'la-citta-di-vetro', time: '1815', hall: 3, format: '2D' },
  { film: 'notte-a-ponente', time: '2045', hall: 3, format: '2D' },
  { film: 'la-citta-di-vetro', time: '2240', hall: 3, format: '2D' },
];

export const GENRES = [...new Set(FILMS.map((f) => f.genre))].sort();

export function film(slug: string): Film | undefined {
  return FILMS.find((f) => f.slug === slug);
}

export function slotsOf(slug: string): Slot[] {
  return SLOTS.filter((s) => s.film === slug).sort((a, b) => a.time.localeCompare(b.time));
}

export function showId(slot: Slot, date: string): string {
  return `${slot.film}.${date}.${slot.time}`;
}

export function makeShow(slot: Slot, date: string): Show {
  return { ...slot, id: showId(slot, date), date, filmData: film(slot.film)! };
}

export function showsOn(offset: number): Show[] {
  const date = dayKey(offset);
  return SLOTS.map((s) => makeShow(s, date));
}

/** Uno spettacolo esiste se il film ha quell'orario e la data e' nei sette giorni. */
export function findShow(id: string | null): Show | undefined {
  if (!id) return undefined;
  const [slug, date, time] = id.split('.');
  if (!slug || !date || !time || offsetOf(date) === null) return undefined;
  const slot = SLOTS.find((s) => s.film === slug && s.time === time);
  return slot ? makeShow(slot, date) : undefined;
}

export function hasStarted(show: { date: string; time: string }): boolean {
  const start = minutesOf(show.date, show.time);
  if (__BUG_B24__) return nowMinutes() >= start + 15;
  return nowMinutes() >= start;
}

export function showLabel(show: { date: string; time: string }): string {
  return `${longDate(show.date)}, ${clock(show.time)}`;
}

export function ratingLabel(rating: Rating): string {
  return rating === 'VM14' ? 'VM14' : 'Per tutti';
}
