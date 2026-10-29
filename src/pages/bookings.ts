import { h, setText } from '../ui/dom';
import type { Page } from '../router';
import { findShowAnyDate } from '../domain/bookingShow';
import { showLabel } from '../domain/films';
import { loadBookings, saveBookings, type Booking } from '../domain/store';
import { minutesOf, nowMinutes, shiftDay } from '../domain/time';
import { euro } from '../ui/format';
import { METHOD_LABELS } from './confirm';

function cancellable(booking: Booking, date: string, time: string): boolean {
  return booking.status !== 'Annullata' && nowMinutes() <= minutesOf(date, time) - 60;
}

export function bookingsPage(): Page {
  const list = h('div', { class: 'booking-list' });
  const bookings = [...loadBookings()].sort((a, b) => b.createdAt - a.createdAt);

  if (!bookings.length) {
    list.append(h('p', { class: 'empty', testid: 'bookings-empty' }, 'Non hai ancora prenotazioni in questo browser.'),
      h('a', { class: 'button', href: '/' }, 'Vai alla programmazione'));
  }

  // Test id stabili dentro ogni prenotazione e codice in data-code: un test id con
  // il codice casuale cambierebbe a ogni run e il catalogo dello Scout ne
  // registrerebbe uno che la run successiva non ritrova.
  for (const booking of bookings) {
    const show = findShowAnyDate(booking.showId);
    if (!show) continue;
    const code = booking.code;
    // B20: la data mostrata e' quella del giorno precedente.
    const shownDate = __BUG_B20__ ? shiftDay(show.date, -1) : show.date;
    const status = h('dd', { testid: 'booking-status' }, booking.status);
    const message = h('p', { class: 'notice', testid: 'booking-message', role: 'status', hidden: true });
    const actions = h('div', { class: 'actions' });
    let article: HTMLElement | undefined;

    const render = (): void => {
      actions.replaceChildren();
      if (cancellable(booking, show.date, show.time)) {
        const confirm = h('button', { type: 'button', class: 'button button--danger', testid: 'booking-cancel-confirm', hidden: true }, 'Conferma annullamento');
        const keep = h('button', { type: 'button', class: 'button button--secondary', testid: 'booking-cancel-keep', hidden: true }, 'Mantieni');
        const cancel = h('button', { type: 'button', class: 'button button--secondary', testid: 'booking-cancel' }, 'Annulla prenotazione');
        cancel.addEventListener('click', () => {
          cancel.hidden = true;
          confirm.hidden = false;
          keep.hidden = false;
        });
        keep.addEventListener('click', () => {
          cancel.hidden = false;
          confirm.hidden = true;
          keep.hidden = true;
        });
        confirm.addEventListener('click', () => {
          const all = loadBookings().map((b) => (b.code === code ? { ...b, status: 'Annullata' as const } : b));
          saveBookings(all);
          booking.status = 'Annullata';
          setText(status, booking.status);
          article?.classList.add('is-cancelled');
          message.hidden = false;
          setText(message, booking.method === 'cassa' ? 'Prenotazione annullata.' : 'Prenotazione annullata. L’importo verrà rimborsato sul metodo di pagamento usato.');
          render();
        });
        actions.append(cancel, confirm, keep);
      } else if (booking.status !== 'Annullata') {
        actions.append(h('p', { class: 'hint', testid: 'booking-not-cancellable' }, 'Non più annullabile: mancano meno di 60 minuti allo spettacolo.'));
      }
    };
    render();

    article = h('article', { class: booking.status === 'Annullata' ? 'booking-item is-cancelled' : 'booking-item', testid: 'booking-item', 'data-code': code },
        h('h2', {}, show.filmData.title, ' ', h('span', { class: 'booking-code', testid: 'booking-code' }, code)),
        h('dl', { class: 'booking-facts' },
          h('div', {}, h('dt', {}, 'Data e ora'), h('dd', { testid: 'booking-date' }, showLabel({ date: shownDate, time: show.time }))),
          h('div', {}, h('dt', {}, 'Sala'), h('dd', { testid: 'booking-hall' }, `Sala ${show.hall} · ${show.format}`)),
          h('div', {}, h('dt', {}, 'Posti'), h('dd', { testid: 'booking-seats' }, booking.seats.join(', '))),
          h('div', {}, h('dt', {}, 'Totale'), h('dd', { testid: 'booking-total' }, euro(booking.paid))),
          h('div', {}, h('dt', {}, 'Pagamento'), h('dd', {}, METHOD_LABELS[booking.method])),
          h('div', {}, h('dt', {}, 'Stato'), status)),
        message,
        actions);
    list.append(article);
  }

  const el = h('div', { class: 'page page--bookings' },
    h('h1', {}, 'Le mie prenotazioni'),
    h('p', { class: 'hint' }, 'Le prenotazioni sono salvate solo in questo browser. Si possono annullare fino a un’ora prima dello spettacolo.'),
    list);
  return { title: 'Le mie prenotazioni', el };
}
