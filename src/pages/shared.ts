import { h } from '../ui/dom';
import type { Show } from '../domain/films';
import { clock } from '../domain/time';

interface ChipOptions {
  show: Show;
  href: string;
  testid: string;
  started: boolean;
}

/** Un orario: link alla mappa se prenotabile, altrimenti testo non cliccabile. */
export function showtimeChip({ show, href, testid, started }: ChipOptions): HTMLElement {
  const detail = h('span', { class: 'showtime__detail' }, `${show.format} · Sala ${show.hall}`);
  if (show.soldOut || started) {
    return h('span', { class: 'showtime is-disabled', testid, 'aria-disabled': 'true' },
      h('span', { class: 'showtime__time' }, clock(show.time)),
      detail,
      h('span', { class: 'showtime__status' }, show.soldOut ? 'Esaurito' : 'Iniziato'));
  }
  return h('a', { class: 'showtime', href, testid },
    h('span', { class: 'showtime__time' }, clock(show.time)),
    detail);
}

export function messagePage(title: string, text: string, testid: string, link?: { href: string; label: string }): HTMLElement {
  return h('div', { class: 'page page--message' },
    h('h1', {}, title),
    h('p', { testid }, text),
    link ? h('a', { class: 'button button--secondary', href: link.href }, link.label) : null);
}

export function stepper(active: 1 | 2 | 3): HTMLElement {
  const steps = ['Posti', 'Biglietti', 'Pagamento'];
  return h('ol', { class: 'stepper', 'aria-label': 'Passi della prenotazione' },
    ...steps.map((label, i) =>
      h('li', { class: i + 1 === active ? 'stepper__step is-active' : i + 1 < active ? 'stepper__step is-done' : 'stepper__step', 'aria-current': i + 1 === active ? 'step' : null },
        h('span', { class: 'stepper__num' }, String(i + 1)), label)));
}
