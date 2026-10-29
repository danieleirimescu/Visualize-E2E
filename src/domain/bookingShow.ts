import { SLOTS, makeShow, showLabel, type Show } from './films';

// Una prenotazione resta consultabile anche quando il suo giorno e' uscito dalla
// finestra di sette giorni della programmazione: qui la data non e' verificata.
export function findShowAnyDate(id: string): Show | undefined {
  const [slug, date, time] = id.split('.');
  if (!/^\d{8}$/.test(date ?? '')) return undefined;
  const slot = SLOTS.find((s) => s.film === slug && s.time === time);
  return slot ? makeShow(slot, date) : undefined;
}

export { showLabel };
