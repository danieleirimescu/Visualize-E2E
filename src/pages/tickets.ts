import { h, setText } from '../ui/dom';
import { navigate, type Page } from '../router';
import { findShow, hasStarted } from '../domain/films';
import { isVip, sortSeats } from '../domain/seats';
import { loadOrder, saveOrder, type Order } from '../domain/store';
import { availableTypes, computeTotals, lineFor, TICKET_LABELS, PROMO_CODE, PROMO_PERCENT, type TicketType } from '../domain/pricing';
import { createSummary } from '../ui/summary';
import { euro } from '../ui/format';
import { tid, LABELS } from '../ui/labels';
import { messagePage, stepper } from './shared';
import { showHeader } from './seats';

function breakdown(seat: string, type: TicketType, show: NonNullable<ReturnType<typeof findShow>>): string {
  const line = lineFor(seat, type, show);
  const parts = [`${TICKET_LABELS[type]} ${euro(line.tariff)}`];
  if (line.surcharge3d) parts.push(`3D ${euro(line.surcharge3d)}`);
  if (line.surchargeVip) parts.push(`VIP ${euro(line.surchargeVip)}`);
  return parts.join(' + ');
}

export function ticketsPage(_: Record<string, string>, query: URLSearchParams): Page {
  const show = findShow(query.get('spettacolo'));
  const stored = loadOrder();
  if (!show || !stored || stored.showId !== show.id || !stored.seats.length) {
    return {
      title: 'Nessun posto selezionato',
      el: messagePage('Nessun posto selezionato', 'Scegli prima uno spettacolo e i posti sulla mappa della sala.', 'tickets-empty', { href: '/', label: 'Vai alla programmazione' }),
    };
  }
  if (hasStarted(show)) {
    return {
      title: 'Spettacolo non disponibile',
      el: messagePage('Spettacolo non disponibile', 'Lo spettacolo è già iniziato e non è più prenotabile.', 'show-unavailable', { href: '/', label: 'Torna alla programmazione' }),
    };
  }

  const types = availableTypes(show);
  let order: Order = { ...stored, types: { ...stored.types } };
  for (const seat of order.seats) {
    if (!order.types[seat] || !types.includes(order.types[seat])) order.types[seat] = 'intero';
  }
  saveOrder(order);

  const summary = createSummary();
  const prices = new Map<string, { price: HTMLElement; detail: HTMLElement }>();

  function refresh(): void {
    const totals = computeTotals(order, show!);
    for (const line of totals.lines) {
      const cell = prices.get(line.seat)!;
      setText(cell.price, euro(line.price));
      setText(cell.detail, breakdown(line.seat, line.type, show!));
    }
    summary.update(totals);
  }

  const rows = h('ul', { class: 'ticket-list' });
  for (const seat of sortSeats(order.seats)) {
    const selectId = `ticket-type-${seat}`;
    const select = h('select', {
      id: selectId,
      testid: selectId,
      onChange: () => {
        order = { ...order, types: { ...order.types, [seat]: select.value as TicketType } };
        saveOrder(order);
        refresh();
      },
    }, ...types.map((t) => h('option', { value: t, selected: order.types[seat] === t }, TICKET_LABELS[t])));
    const price = h('strong', { class: 'ticket-row__price', testid: `ticket-price-${seat}` });
    const detail = h('span', { class: 'ticket-row__detail', testid: `ticket-breakdown-${seat}` });
    prices.set(seat, { price, detail });
    rows.append(h('li', { class: 'ticket-row', testid: `ticket-row-${seat}` },
      h('label', { for: selectId, class: 'ticket-row__seat' }, `Posto ${seat}`, isVip(seat) ? h('span', { class: 'badge badge--vip' }, 'VIP') : null),
      select,
      detail,
      price));
  }

  const promoInput = h('input', { id: 'promo-code', testid: 'promo-code', type: 'text', autocomplete: 'off', placeholder: 'Es. codice sconto', maxlength: '20' });
  const promoMessage = h('p', { class: 'promo__message', testid: 'promo-message', role: 'status' });
  const promoButton = h('button', { type: 'button', class: 'button button--secondary', testid: 'promo-apply' }, LABELS.applyPromo);
  if (order.promoCount > 0) {
    promoMessage.classList.add('is-success');
    setText(promoMessage, `Codice ${PROMO_CODE} applicato: sconto del ${PROMO_PERCENT}% su biglietti e supplementi.`);
  }
  promoButton.addEventListener('click', () => {
    const code = promoInput.value.trim().toUpperCase();
    promoMessage.classList.remove('is-success', 'is-error');
    if (code !== PROMO_CODE) {
      promoMessage.classList.add('is-error');
      setText(promoMessage, 'Codice promozionale non valido.');
      return;
    }
    if (order.promoCount > 0 && !__BUG_B06__) {
      promoMessage.classList.add('is-error');
      setText(promoMessage, 'Il codice è già stato applicato.');
      return;
    }
    order = { ...order, promoCount: order.promoCount + 1 };
    saveOrder(order);
    promoMessage.classList.add('is-success');
    setText(promoMessage, `Codice ${PROMO_CODE} applicato: sconto del ${PROMO_PERCENT}% su biglietti e supplementi.`);
    refresh();
  });

  const proceed = h('button', { type: 'button', class: 'button', testid: tid('tickets-continue'), onClick: () => navigate('/checkout') }, LABELS.proceed);

  const el = h('div', { class: 'page page--tickets' },
    stepper(2),
    showHeader(show),
    h('div', { class: 'two-columns' },
      h('div', {},
        h('h2', {}, 'Biglietti'),
        rows,
        h('div', { class: 'promo' },
          h('label', { for: 'promo-code' }, 'Codice promozionale'),
          h('div', { class: 'promo__row' }, promoInput, promoButton),
          promoMessage),
        h('div', { class: 'actions' },
          h('a', { class: 'button button--secondary', href: `/posti?spettacolo=${encodeURIComponent(show.id)}`, testid: 'tickets-back' }, '← Torna ai posti'),
          proceed)),
      summary.el));

  refresh();
  return { title: `Biglietti · ${show.filmData.title}`, el };
}
