import { h, setText } from '../ui/dom';
import { navigate, type Page } from '../router';
import { findShow, hasStarted, showLabel } from '../domain/films';
import { ROWS, SEATS_PER_ROW, MAX_SEATS, isVip, occupiedSeats, isolatedSeats, sortSeats } from '../domain/seats';
import { loadOrder, saveOrder, type Order } from '../domain/store';
import { tid, LABELS } from '../ui/labels';
import { messagePage, stepper } from './shared';

export function showHeader(show: NonNullable<ReturnType<typeof findShow>>): HTMLElement {
  return h('div', { class: 'show-info', testid: 'show-info' },
    h('h1', { testid: 'show-title' }, show.filmData.title),
    h('p', { class: 'show-info__meta' },
      h('span', { testid: 'show-datetime' }, showLabel(show)), ' · ',
      h('span', { testid: 'show-hall' }, `Sala ${show.hall}`), ' · ',
      h('span', { testid: 'show-format' }, show.format)));
}

export function seatsPage(_: Record<string, string>, query: URLSearchParams): Page {
  const id = query.get('spettacolo');
  const show = findShow(id);
  if (!show) {
    return {
      title: 'Spettacolo non trovato',
      el: messagePage('Spettacolo non trovato', 'Lo spettacolo richiesto non esiste o non è più in programmazione.', 'show-not-found', { href: '/', label: 'Vai alla programmazione' }),
    };
  }
  if (hasStarted(show)) {
    return {
      title: 'Spettacolo non disponibile',
      el: h('div', { class: 'page page--seats' },
        showHeader(show),
        h('p', { class: 'notice notice--error', testid: 'show-unavailable' }, 'Lo spettacolo è già iniziato e non è più prenotabile.'),
        h('a', { class: 'button button--secondary', href: '/' }, 'Torna alla programmazione')),
    };
  }

  const taken = occupiedSeats(show);
  const previous = loadOrder();
  let order: Order;
  if (previous && previous.showId === show.id) {
    // Si torna allo stesso spettacolo (es. dai biglietti): la selezione resta.
    order = __BUG_B17__ ? { ...previous, seats: [], types: {} } : previous;
  } else {
    // Un altro spettacolo azzera la selezione precedente.
    const carried = __BUG_B16__ && previous ? previous.seats.filter((s) => !taken.has(s)) : [];
    order = { showId: show.id, seats: carried, types: {}, promoCount: 0 };
  }
  order.seats = order.seats.filter((s) => !taken.has(s));
  saveOrder(order.seats.length ? order : null);

  const selected = new Set(order.seats);
  const seatButtons = new Map<string, HTMLButtonElement>();
  const count = h('span', { testid: 'selected-count' });
  const list = h('span', { testid: 'selected-seats' });
  const error = h('p', { class: 'notice notice--error', testid: 'seat-error', role: 'alert' });
  const proceed = h('button', { type: 'button', class: 'button', testid: tid('seats-continue') }, LABELS.proceed);

  function persist(): void {
    order = { ...order, seats: sortSeats(selected), types: Object.fromEntries(Object.entries(order.types).filter(([s]) => selected.has(s))) };
    saveOrder(selected.size ? order : null);
  }

  function refresh(): void {
    const n = selected.size;
    setText(count, String(__BUG_B05__ && n >= 2 ? n - 1 : n));
    setText(list, n ? sortSeats(selected).join(', ') : 'nessuno');
    proceed.disabled = n === 0;
    for (const [seat, button] of seatButtons) {
      button.classList.toggle('is-selected', selected.has(seat));
    }
  }

  function showError(message: string): void {
    setText(error, message);
  }

  function toggle(seat: string): void {
    if (taken.has(seat)) {
      showError(`Il posto ${seat} è occupato.`);
      return;
    }
    if (selected.has(seat)) {
      selected.delete(seat);
    } else {
      const limit = __BUG_B08__ ? 10 : MAX_SEATS;
      if (selected.size >= limit) {
        showError(`Puoi selezionare al massimo ${MAX_SEATS} posti.`);
        return;
      }
      selected.add(seat);
    }
    showError('');
    persist();
    refresh();
  }

  proceed.addEventListener('click', () => {
    if (!selected.size) return;
    if (!__BUG_B23__) {
      const isolated = isolatedSeats(selected, taken);
      if (isolated.length) {
        showError(`La selezione lascia un posto singolo isolato (${isolated.join(', ')}): scegli posti vicini o cambia la selezione.`);
        return;
      }
    }
    persist();
    navigate(`/biglietti?spettacolo=${encodeURIComponent(show.id)}`);
  });

  const grid = h('div', { class: 'seat-grid', role: 'group', 'aria-label': `Posti della Sala ${show.hall}` });
  for (const row of ROWS) {
    const rowEl = h('div', { class: isVip(`${row}1`) ? 'seat-row seat-row--vip' : 'seat-row' },
      h('span', { class: 'seat-row__label', 'aria-hidden': 'true' }, row));
    for (let n = 1; n <= SEATS_PER_ROW; n++) {
      const seat = `${row}${n}`;
      const vip = isVip(seat);
      // Niente aria-disabled sui posti occupati: un click deve arrivare e mostrare
      // il messaggio, invece di essere rifiutato prima ancora di partire.
      const occupied = taken.has(seat);
      const button = h('button', {
        type: 'button',
        class: ['seat', vip ? 'seat--vip' : '', occupied ? 'is-occupied' : ''].filter(Boolean).join(' '),
        testid: tid(`seat-${seat}`),
        'aria-label': `Fila ${row}, posto ${n}${vip ? ', poltrona VIP' : ''}`,
        onClick: () => toggle(seat),
      }, String(n));
      seatButtons.set(seat, button);
      rowEl.append(button);
    }
    rowEl.append(h('span', { class: 'seat-row__label', 'aria-hidden': 'true' }, row));
    grid.append(rowEl);
  }

  const legend = h('ul', { class: 'legend', testid: 'seat-legend' },
    h('li', {}, h('span', { class: 'legend__swatch' }), 'Libero'),
    h('li', {}, h('span', { class: 'legend__swatch legend__swatch--occupied' }), 'Occupato'),
    h('li', {}, h('span', { class: 'legend__swatch legend__swatch--selected' }), 'Selezionato'),
    h('li', {}, h('span', { class: 'legend__swatch legend__swatch--vip' }), 'Poltrona VIP (+3,00 €)'));

  const mapArea = h('div', { class: 'seat-map', testid: 'seat-map' });
  const content: HTMLElement[] = [
    legend,
    h('div', { class: 'screen', 'aria-hidden': 'true' }, 'Schermo'),
    grid,
  ];
  if (show.soldOut) {
    content.unshift(h('p', { class: 'notice', testid: 'soldout-message' }, 'Tutto esaurito: non ci sono posti disponibili per questo spettacolo.'));
  }

  let timer: number | undefined;
  if (__BUG_T01__) {
    mapArea.append(h('p', { class: 'loading', testid: 'seatmap-loading' }, 'Caricamento della sala…'));
    timer = window.setTimeout(() => mapArea.replaceChildren(...content), 2500 + Math.random() * 3500);
  } else {
    mapArea.append(...content);
  }

  const el = h('div', { class: 'page page--seats' },
    stepper(1),
    h('a', { class: 'back-link', href: `/film/${show.film}`, testid: 'seats-back' }, `← ${show.filmData.title}`),
    showHeader(show),
    h('div', { class: 'seats-layout' },
      mapArea,
      h('aside', { class: 'seat-panel' },
        h('p', {}, 'Posti selezionati: ', count),
        h('p', {}, 'Posti: ', list),
        h('p', { class: 'hint' }, `Puoi scegliere fino a ${MAX_SEATS} posti. Non lasciare un posto singolo libero fra due posti occupati.`),
        error,
        proceed)));

  refresh();
  return { title: `Posti · ${show.filmData.title}`, el, dispose: () => window.clearTimeout(timer) };
}
