import { h } from '../ui/dom';
import { navigate, type Page } from '../router';
import { FILMS, GENRES, showsOn, hasStarted, ratingLabel, makeShow, type Show } from '../domain/films';
import { dayKey, dayTabLabel, longDate, clock } from '../domain/time';
import { showtimeChip } from './shared';

function withQuery(query: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(query);
  if (value) next.set(key, value);
  else next.delete(key);
  const text = next.toString();
  return text ? `/?${text}` : '/';
}

export function homePage(_: Record<string, string>, query: URLSearchParams): Page {
  const rawDay = Number.parseInt(query.get('giorno') ?? '0', 10);
  const day = Number.isInteger(rawDay) && rawDay >= 0 && rawDay <= 6 ? rawDay : 0;
  const genre = query.get('genere') ?? '';
  const format = query.get('formato') ?? '';

  const tabs = h('nav', { class: 'day-tabs', 'aria-label': 'Giorno della programmazione' });
  for (let i = 0; i < 7; i++) {
    tabs.append(
      h('a', {
        href: withQuery(query, 'giorno', i === 0 ? '' : String(i)),
        class: i === day ? 'day-tab is-active' : 'day-tab',
        testid: `day-tab-${i}`,
        'aria-current': i === day ? 'date' : null,
      }, dayTabLabel(i)),
    );
  }

  const genreSelect = h('select', { id: 'filter-genre', testid: 'filter-genre', onChange: () => navigate(withQuery(query, 'genere', genreSelect.value)) },
    h('option', { value: '' }, 'Tutti i generi'),
    ...GENRES.map((g) => h('option', { value: g, selected: g === genre }, g)));
  const formatSelect = h('select', { id: 'filter-format', testid: 'filter-format', onChange: () => navigate(withQuery(query, 'formato', formatSelect.value)) },
    h('option', { value: '' }, 'Tutti i formati'),
    h('option', { value: '2D', selected: format === '2D' }, '2D'),
    h('option', { value: '3D', selected: format === '3D' }, '3D'));

  const filters = h('div', { class: 'filters' },
    h('label', { for: 'filter-genre' }, 'Genere', genreSelect),
    h('label', { for: 'filter-format' }, 'Formato', formatSelect));

  // B22: dalle schede successive a oggi gli orari puntano al giorno dopo.
  const linkDay = __BUG_B22__ && day > 0 ? day + 1 : day;
  const linkDate = dayKey(linkDay);
  const shows = showsOn(day);

  const list = h('div', { class: 'film-list' });
  for (const f of FILMS) {
    if (genre && f.genre !== genre) continue;
    const filmShows = shows.filter((s) => s.film === f.slug);
    let visible: Show[];
    if (!format) visible = filmShows;
    else if (__BUG_B14__) visible = filmShows.some((s) => s.format === format) ? filmShows : [];
    else visible = filmShows.filter((s) => s.format === format);
    if (!visible.length) continue;

    const chips = h('ul', { class: 'showtimes', 'aria-label': `Orari di ${f.title}` });
    for (const show of visible.sort((a, b) => a.time.localeCompare(b.time))) {
      const target = makeShow(show, linkDate);
      chips.append(h('li', {}, showtimeChip({
        show,
        href: `/posti?spettacolo=${encodeURIComponent(target.id)}`,
        testid: `showtime-${f.slug}-${show.time}`,
        started: hasStarted(show),
      })));
    }

    list.append(
      h('article', { class: 'film-card', testid: `film-card-${f.slug}`, style: `--accent:${f.accent}` },
        h('div', { class: 'film-card__poster', 'aria-hidden': 'true' }, f.title.charAt(0)),
        h('div', { class: 'film-card__body' },
          h('h2', { class: 'film-card__title' },
            h('a', { href: `/film/${f.slug}`, testid: `film-title-${f.slug}` }, f.title)),
          h('p', { class: 'film-card__meta' },
            h('span', { testid: `film-genre-${f.slug}` }, f.genre), ' · ',
            h('span', { testid: `film-duration-${f.slug}` }, `${f.duration} min`), ' · ',
            h('span', { class: f.rating === 'VM14' ? 'badge badge--vm' : 'badge', testid: `film-rating-${f.slug}` }, ratingLabel(f.rating))),
          chips)),
    );
  }
  if (!list.children.length) {
    list.append(h('p', { class: 'empty', testid: 'programmazione-empty' }, 'Nessuno spettacolo corrisponde ai filtri scelti.'));
  }

  const el = h('div', { class: 'page page--home' },
    h('div', { class: 'page-head' },
      h('h1', {}, 'Programmazione'),
      h('p', { class: 'page-head__sub', testid: 'selected-day-label' }, longDate(dayKey(day)))),
    tabs,
    filters,
    list,
    h('p', { class: 'hint' }, `Orari in ora italiana. Le prenotazioni online chiudono all'inizio dello spettacolo; ultimo spettacolo alle ${clock('2250')}.`));

  return { title: 'Programmazione', el };
}
