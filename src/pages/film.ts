import { h } from '../ui/dom';
import type { Page } from '../router';
import { film, slotsOf, makeShow, hasStarted, ratingLabel } from '../domain/films';
import { dayKey, dayTabLabel, longDate } from '../domain/time';
import { showtimeChip, messagePage } from './shared';

export function filmPage(params: Record<string, string>): Page {
  const f = film(params.slug);
  if (!f) {
    return {
      title: 'Film non trovato',
      el: messagePage('Film non trovato', 'Il film che cerchi non è in programmazione.', 'film-not-found', { href: '/', label: 'Vai alla programmazione' }),
    };
  }

  // B15: la scheda dei film oltre le due ore mostra 10 minuti in meno.
  const duration = __BUG_B15__ && f.duration > 120 ? f.duration - 10 : f.duration;

  const schedule = h('div', { class: 'schedule' });
  for (let i = 0; i < 7; i++) {
    const date = dayKey(i);
    const chips = h('ul', { class: 'showtimes' });
    for (const slot of slotsOf(f.slug)) {
      const show = makeShow(slot, date);
      chips.append(h('li', {}, showtimeChip({
        show,
        href: `/posti?spettacolo=${encodeURIComponent(show.id)}`,
        testid: `showtime-${i}-${slot.time}`,
        started: hasStarted(show),
      })));
    }
    schedule.append(
      h('section', { class: 'schedule__day', testid: `film-schedule-day-${i}` },
        h('h3', {}, `${dayTabLabel(i)} `, h('span', { class: 'schedule__date' }, longDate(date))),
        chips));
  }

  const el = h('div', { class: 'page page--film', style: `--accent:${f.accent}` },
    h('a', { class: 'back-link', href: '/', testid: 'film-back' }, '← Programmazione'),
    h('div', { class: 'film-hero' },
      h('div', { class: 'film-hero__poster', 'aria-hidden': 'true' }, f.title.charAt(0)),
      h('div', { class: 'film-hero__body' },
        h('h1', { testid: 'film-title' }, f.title),
        h('p', { class: 'film-card__meta' },
          h('span', { testid: 'film-genre' }, f.genre), ' · ',
          h('span', { testid: 'film-duration' }, `${duration} min`), ' · ',
          h('span', { class: f.rating === 'VM14' ? 'badge badge--vm' : 'badge', testid: 'film-rating' }, ratingLabel(f.rating))),
        h('p', { class: 'film-plot', testid: 'film-plot' }, f.plot),
        h('dl', { class: 'film-facts' },
          h('div', {}, h('dt', {}, 'Regia'), h('dd', { testid: 'film-director' }, f.director)),
          h('div', {}, h('dt', {}, 'Interpreti'), h('dd', { testid: 'film-cast' }, f.cast.join(', ')))))),
    h('h2', {}, 'Orari'),
    schedule);

  return { title: f.title, el };
}
