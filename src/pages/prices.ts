import { h } from '../ui/dom';
import type { Page } from '../router';
import { TARIFFS, TICKET_LABELS, SURCHARGE_3D, SURCHARGE_VIP, SERVICE_FEE, PROMO_CODE, PROMO_PERCENT, CASSA_MAX_TICKETS, type TicketType } from '../domain/pricing';
import { MAX_SEATS } from '../domain/seats';
import { euro } from '../ui/format';

export function pricesPage(): Page {
  const rows = (Object.keys(TARIFFS) as TicketType[]).map((t) =>
    h('tr', {}, h('th', { scope: 'row' }, TICKET_LABELS[t]), h('td', { testid: `price-${t}` }, euro(TARIFFS[t]))));

  const el = h('div', { class: 'page page--prices' },
    h('h1', {}, 'Prezzi e regole'),
    h('table', { class: 'price-table' },
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Tariffa'), h('th', { scope: 'col' }, 'Prezzo'))),
      h('tbody', {}, ...rows)),
    h('ul', { class: 'rules' },
      h('li', { testid: 'rule-3d' }, `Supplemento 3D: ${euro(SURCHARGE_3D)} per biglietto, occhiali inclusi.`),
      h('li', { testid: 'rule-vip' }, `Poltrone VIP (fila H): ${euro(SURCHARGE_VIP)} per posto.`),
      h('li', { testid: 'rule-fee' }, `Commissione di servizio online: ${euro(SERVICE_FEE)} per biglietto, non applicata con il pagamento in cassa.`),
      h('li', { testid: 'rule-promo' }, `Codice ${PROMO_CODE}: ${PROMO_PERCENT}% di sconto su biglietti e supplementi, una volta per prenotazione.`),
      h('li', { testid: 'rule-bambini' }, 'La tariffa Bambini non è disponibile per i film VM14.'),
      h('li', { testid: 'rule-seats' }, `Al massimo ${MAX_SEATS} posti per prenotazione.`),
      h('li', { testid: 'rule-cassa' }, `Pagamento in cassa per prenotazioni fino a ${CASSA_MAX_TICKETS} biglietti.`),
      h('li', { testid: 'rule-cancel' }, 'Annullamento gratuito fino a un’ora prima dello spettacolo.')));
  return { title: 'Prezzi', el };
}
