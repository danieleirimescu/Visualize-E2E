import { h, setText } from './dom';
import { euro, discountText, plural } from './format';
import type { Totals } from '../domain/pricing';

export interface Summary {
  el: HTMLElement;
  update(totals: Totals): void;
}

const ROWS: { key: keyof Totals | 'count'; label: string; testid: string }[] = [
  { key: 'count', label: 'Biglietti', testid: 'summary-count' },
  { key: 'tickets', label: 'Prezzo dei biglietti', testid: 'summary-tickets' },
  { key: 'supplements', label: 'Supplementi', testid: 'summary-supplements' },
  { key: 'fee', label: 'Commissione di servizio', testid: 'summary-fee' },
  { key: 'discount', label: 'Sconto', testid: 'summary-discount' },
  { key: 'total', label: 'Totale', testid: 'summary-total' },
];

// Il riepilogo aggiorna i propri nodi di testo invece di ricrearli: la pipeline
// segue l'identita' di un elemento sul nodo DOM, e un nodo ricreato a ogni
// cambio di prezzo diventerebbe ogni volta una voce nuova del catalogo.
export function createSummary(): Summary {
  const values = new Map<string, HTMLElement>();
  let el: HTMLElement;

  if (__BUG_C03__) {
    const body = h('tbody');
    for (const row of ROWS) {
      const value = h('td', { class: 'recap-table__amount', testid: row.testid });
      values.set(row.key, value);
      body.append(h('tr', { class: row.key === 'total' ? 'recap-table__grand' : 'recap-table__line' }, h('th', { scope: 'row' }, row.label), value));
    }
    el = h('section', { class: 'recap', 'aria-labelledby': 'recap-title' },
      h('h2', { id: 'recap-title', class: 'recap__title' }, 'Il tuo ordine'),
      h('table', { class: 'recap-table' }, body));
  } else {
    const list = h('dl', { class: 'summary-list' });
    for (const row of ROWS) {
      const value = h('dd', { testid: row.testid });
      values.set(row.key, value);
      list.append(h('div', { class: row.key === 'total' ? 'summary-row summary-total' : 'summary-row' }, h('dt', {}, row.label), value));
    }
    el = h('section', { class: 'summary', 'aria-labelledby': 'summary-title' },
      h('h2', { id: 'summary-title' }, 'Riepilogo'), list);
  }

  return {
    el,
    update(totals) {
      setText(values.get('count')!, plural(totals.count, 'biglietto', 'biglietti'));
      setText(values.get('tickets')!, euro(totals.tickets));
      setText(values.get('supplements')!, euro(totals.supplements));
      setText(values.get('fee')!, euro(totals.fee));
      setText(values.get('discount')!, discountText(totals.discount));
      setText(values.get('total')!, euro(totals.total));
    },
  };
}
