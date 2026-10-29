import { h } from '../ui/dom';
import type { Page } from '../router';
import { findShowAnyDate, showLabel } from '../domain/bookingShow';
import { loadBookings } from '../domain/store';
import { TICKET_LABELS } from '../domain/pricing';
import { euro } from '../ui/format';
import { messagePage } from './shared';

export const METHOD_LABELS = { card: 'Carta di credito', gift: 'Carta regalo Visualize', cassa: 'Paga in cassa' } as const;

export function confirmPage(_: Record<string, string>, query: URLSearchParams): Page {
  const code = query.get('codice') ?? '';
  const booking = loadBookings().find((b) => b.code === code);
  const show = booking ? findShowAnyDate(booking.showId) : undefined;
  if (!booking || !show) {
    return {
      title: 'Prenotazione non trovata',
      el: messagePage('Prenotazione non trovata', 'Non troviamo una prenotazione con questo codice in questo browser.', 'booking-not-found', { href: '/prenotazioni', label: 'Le mie prenotazioni' }),
    };
  }

  // B19: la conferma mostra il totale prima dello sconto.
  const shownTotal = __BUG_B19__ ? booking.totals.total + booking.totals.discount : booking.paid;
  const pending = booking.method === 'cassa';

  const el = h('div', { class: 'page page--confirm' },
    h('div', { class: 'confirm-hero' },
      h('p', { class: 'confirm-hero__icon', 'aria-hidden': 'true' }, '✓'),
      h('h1', {}, pending ? 'Prenotazione registrata' : 'Prenotazione confermata'),
      h('p', {}, 'Codice di prenotazione: ', h('strong', { class: 'booking-code', testid: 'booking-code' }, booking.code))),
    h('dl', { class: 'booking-facts' },
      h('div', {}, h('dt', {}, 'Stato'), h('dd', { testid: 'booking-status' }, booking.status)),
      h('div', {}, h('dt', {}, 'Film'), h('dd', { testid: 'booking-film' }, show.filmData.title)),
      h('div', {}, h('dt', {}, 'Data e ora'), h('dd', { testid: 'booking-datetime' }, showLabel(show))),
      h('div', {}, h('dt', {}, 'Sala'), h('dd', { testid: 'booking-hall' }, `Sala ${show.hall} · ${show.format}`)),
      h('div', {}, h('dt', {}, 'Posti'), h('dd', { testid: 'booking-seats' }, booking.seats.join(', '))),
      h('div', {}, h('dt', {}, 'Biglietti'), h('dd', { testid: 'booking-tickets' }, booking.seats.map((s) => `${s} ${TICKET_LABELS[booking.types[s] ?? 'intero']}`).join(', '))),
      h('div', {}, h('dt', {}, 'Pagamento'), h('dd', { testid: 'booking-method' }, METHOD_LABELS[booking.method])),
      h('div', { class: 'booking-facts__total' }, h('dt', {}, pending ? 'Da pagare in cassa' : 'Totale pagato'), h('dd', { testid: 'booking-total' }, euro(shownTotal)))),
    h('p', { class: 'notice', testid: 'booking-email-note' },
      pending
        ? 'Ritira e paga i biglietti in cassa almeno 30 minuti prima dello spettacolo.'
        : `Abbiamo inviato i biglietti a ${booking.email}.`),
    h('div', { class: 'actions' },
      h('a', { class: 'button', href: '/prenotazioni', testid: 'confirm-bookings' }, 'Le mie prenotazioni'),
      h('a', { class: 'button button--secondary', href: '/', testid: 'confirm-home' }, 'Torna alla programmazione')));

  return { title: 'Prenotazione', el };
}
