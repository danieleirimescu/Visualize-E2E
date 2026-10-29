import { h, setText } from '../ui/dom';
import { navigate, type Page } from '../router';
import { findShow, hasStarted, showLabel } from '../domain/films';
import { sortSeats } from '../domain/seats';
import { loadOrder, saveOrder, addBooking, newBookingCode, saveGiftBalance, type Order } from '../domain/store';
import { computeTotals, cassaAvailable, CASSA_MAX_TICKETS, TICKET_LABELS, type PaymentMethod, type Totals } from '../domain/pricing';
import {
  cardNumberError, expiryError, cvvError, cardOutcome, formatCardNumber, lookupGift, THREE_DS_CODE, digits,
} from '../domain/payment';
import { createSummary } from '../ui/summary';
import { euro } from '../ui/format';
import { LABELS } from '../ui/labels';
import { messagePage, stepper } from './shared';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d ]{6,16}$/;

interface Field {
  input: HTMLInputElement;
  error: HTMLElement;
  validate: () => string | null;
}

function field(id: string, label: string, attrs: Record<string, unknown> = {}): { wrap: HTMLElement; input: HTMLInputElement; error: HTMLElement } {
  const input = h('input', { id, name: id, testid: id, 'aria-describedby': `${id}-error`, ...attrs });
  const error = h('p', { class: 'field__error', id: `${id}-error`, testid: `${id}-error` });
  const wrap = h('div', { class: 'field' }, h('label', { for: id }, label), input, error);
  return { wrap, input, error };
}

export function checkoutPage(): Page {
  const stored = loadOrder();
  const show = stored ? findShow(stored.showId) : undefined;
  if (!stored || !show || !stored.seats.length) {
    return {
      title: 'Nessun ordine in corso',
      el: messagePage('Nessun ordine in corso', 'Non c’è nessun ordine da pagare. Scegli uno spettacolo e i posti per iniziare.', 'checkout-empty', { href: '/', label: 'Vai alla programmazione' }),
    };
  }
  if (hasStarted(show)) {
    return {
      title: 'Spettacolo non disponibile',
      el: messagePage('Spettacolo non disponibile', 'Lo spettacolo è già iniziato e non è più prenotabile.', 'show-unavailable', { href: '/', label: 'Torna alla programmazione' }),
    };
  }
  const order: Order = stored;
  const count = order.seats.length;
  let method: PaymentMethod = 'card';
  let totals: Totals = computeTotals(order, show, method);

  // --- Dati dell'acquirente -------------------------------------------------
  const firstName = field('buyer-first-name', 'Nome', { autocomplete: 'given-name', required: true });
  const lastName = field('buyer-last-name', 'Cognome', { autocomplete: 'family-name', required: true });
  const email = field('buyer-email', 'Email', { type: 'email', autocomplete: 'email', required: true });
  const emailConfirm = field('buyer-email-confirm', 'Conferma email', { type: 'email', autocomplete: 'off', required: true });
  const phone = field('buyer-phone', 'Telefono (facoltativo)', { type: 'tel', autocomplete: 'tel' });
  const terms = h('input', { type: 'checkbox', id: 'terms-accept', testid: 'terms-accept', 'aria-describedby': 'terms-accept-error' });
  const termsError = h('p', { class: 'field__error', id: 'terms-accept-error', testid: 'terms-accept-error' });

  const buyerFields: Field[] = [
    { ...firstName, validate: () => (firstName.input.value.trim() ? null : 'Campo obbligatorio.') },
    { ...lastName, validate: () => (lastName.input.value.trim() ? null : 'Campo obbligatorio.') },
    {
      ...email,
      validate: () => {
        const v = email.input.value.trim();
        if (!v) return 'Campo obbligatorio.';
        return EMAIL.test(v) ? null : 'Inserisci un indirizzo email valido.';
      },
    },
    {
      ...emailConfirm,
      validate: () => {
        const v = emailConfirm.input.value.trim();
        if (!v) return 'Campo obbligatorio.';
        return v.toLowerCase() === email.input.value.trim().toLowerCase() ? null : 'Le email non coincidono.';
      },
    },
    {
      ...phone,
      validate: () => {
        const v = phone.input.value.trim();
        return !v || PHONE.test(v) ? null : 'Numero di telefono non valido.';
      },
    },
    { input: terms, error: termsError, validate: () => (terms.checked ? null : 'Devi accettare le condizioni di vendita.') },
  ];

  // --- Metodi di pagamento --------------------------------------------------
  const cardHolder = field('card-holder', 'Titolare della carta', { autocomplete: 'cc-name' });
  const cardNumber = field('card-number', 'Numero della carta', { inputmode: 'numeric', autocomplete: 'cc-number', placeholder: '0000 0000 0000 0000', maxlength: '19' });
  const cardExpiry = field('card-expiry', 'Scadenza (MM/AA)', { inputmode: 'numeric', autocomplete: 'cc-exp', placeholder: 'MM/AA', maxlength: '5' });
  const cardCvv = field('card-cvv', 'Codice di sicurezza (CVV)', { inputmode: 'numeric', autocomplete: 'cc-csc', placeholder: '123', maxlength: '4' });
  cardNumber.input.addEventListener('input', () => {
    const formatted = formatCardNumber(cardNumber.input.value);
    if (formatted !== cardNumber.input.value) cardNumber.input.value = formatted;
  });
  cardExpiry.input.addEventListener('input', (event) => {
    const ds = digits(cardExpiry.input.value).slice(0, 4);
    const deleting = (event as InputEvent).inputType?.startsWith('delete');
    cardExpiry.input.value = ds.length > 2 || (ds.length === 2 && !deleting) ? `${ds.slice(0, 2)}/${ds.slice(2)}` : ds;
  });
  const cardFields: Field[] = [
    { ...cardHolder, validate: () => (cardHolder.input.value.trim().length >= 2 ? null : 'Campo obbligatorio.') },
    { ...cardNumber, validate: () => cardNumberError(cardNumber.input.value) },
    { ...cardExpiry, validate: () => expiryError(cardExpiry.input.value) },
    { ...cardCvv, validate: () => cvvError(cardCvv.input.value, cardNumber.input.value) },
  ];

  const giftCode = field('gift-code', 'Codice della carta regalo', { autocomplete: 'off', placeholder: 'GIFT-0000-0000-0000', maxlength: '19' });
  const giftFields: Field[] = [
    {
      ...giftCode,
      validate: () => {
        if (!giftCode.input.value.trim()) return 'Campo obbligatorio.';
        const found = lookupGift(giftCode.input.value);
        return found.ok || found.message !== 'Formato del codice non valido.' ? null : found.message;
      },
    },
  ];

  const cassaOk = cassaAvailable(count);
  const radios = new Map<PaymentMethod, HTMLInputElement>();
  const panels = new Map<PaymentMethod, HTMLElement>();
  const methodOptions: { value: PaymentMethod; label: string; testid: string }[] = [
    { value: 'card', label: 'Carta di credito', testid: 'payment-method-card' },
    { value: 'gift', label: 'Carta regalo Visualize', testid: 'payment-method-gift' },
    { value: 'cassa', label: 'Paga in cassa', testid: 'payment-method-cassa' },
  ];
  const methodList = h('div', { class: 'methods', role: 'radiogroup', 'aria-label': 'Metodo di pagamento' });
  for (const option of methodOptions) {
    const disabled = option.value === 'cassa' && !cassaOk;
    const radio = h('input', {
      type: 'radio', name: 'payment-method', id: option.testid, value: option.value, testid: option.testid,
      checked: option.value === method, disabled,
      onChange: () => selectMethod(option.value),
    });
    radios.set(option.value, radio);
    methodList.append(h('label', { class: disabled ? 'method is-disabled' : 'method', for: option.testid }, radio, option.label));
  }
  if (!cassaOk) {
    methodList.append(h('p', { class: 'hint', testid: 'cassa-unavailable' }, `Il pagamento in cassa è disponibile solo fino a ${CASSA_MAX_TICKETS} biglietti.`));
  }

  panels.set('card', h('div', { class: 'method-panel', testid: 'panel-card' },
    h('div', { class: 'field-grid' }, cardHolder.wrap, cardNumber.wrap, cardExpiry.wrap, cardCvv.wrap),
    h('details', { class: 'test-cards', testid: 'test-cards-hint' },
      h('summary', {}, 'Ambiente di prova: carte di test'),
      h('ul', {},
        h('li', {}, '4242 4242 4242 4242: pagamento approvato'),
        h('li', {}, '4000 0000 0000 0002: pagamento rifiutato dalla banca'),
        h('li', {}, '4000 0000 0000 9995: fondi insufficienti'),
        h('li', {}, '4000 0000 0000 3220: verifica 3D Secure (codice 123456)'),
        h('li', {}, '3782 822463 10005: American Express approvata (CVV di 4 cifre)'),
        h('li', {}, 'Qualunque scadenza futura e qualunque titolare.')))));
  panels.set('gift', h('div', { class: 'method-panel', testid: 'panel-gift', hidden: true },
    giftCode.wrap,
    h('p', { class: 'hint' }, 'Il saldo della carta regalo si riduce dell’importo pagato.')));
  panels.set('cassa', h('div', { class: 'method-panel', testid: 'panel-cassa', hidden: true },
    h('p', { testid: 'cassa-note' }, 'Ritira e paga i biglietti in cassa almeno 30 minuti prima dello spettacolo. Senza commissione di servizio.')));

  // --- Riepilogo e pagamento ------------------------------------------------
  const summary = createSummary();
  const payButton = h('button', { type: 'button', class: 'button button--pay', testid: 'pay-button' }, LABELS.pay);
  const processing = h('p', { class: 'notice', testid: 'payment-processing', role: 'status', hidden: true }, 'Pagamento in corso…');
  const paymentError = h('p', { class: 'notice notice--error', testid: 'payment-error', role: 'alert', hidden: true });

  function selectMethod(next: PaymentMethod): void {
    method = next;
    for (const [m, panel] of panels) panel.hidden = m !== method;
    totals = computeTotals(order, show!, method);
    summary.update(totals);
    setText(payButton, method === 'cassa' ? 'Conferma prenotazione' : `${LABELS.pay} · ${euro(totals.total)}`);
    hidePaymentError();
  }

  function showPaymentError(message: string): void {
    paymentError.hidden = false;
    setText(paymentError, message);
  }
  function hidePaymentError(): void {
    paymentError.hidden = true;
    setText(paymentError, '');
  }

  function check(fields: Field[]): boolean {
    let firstInvalid: HTMLInputElement | null = null;
    for (const f of fields) {
      const message = f.validate();
      setText(f.error, message ?? '');
      f.input.setAttribute('aria-invalid', message ? 'true' : 'false');
      if (message && !firstInvalid) firstInvalid = f.input;
    }
    firstInvalid?.focus();
    return !firstInvalid;
  }

  for (const f of [...buyerFields, ...cardFields, ...giftFields]) {
    f.input.addEventListener('blur', () => {
      if (f.input.type === 'checkbox' || !f.input.value) return;
      const message = f.validate();
      setText(f.error, message ?? '');
      f.input.setAttribute('aria-invalid', message ? 'true' : 'false');
    });
  }
  terms.addEventListener('change', () => {
    if (terms.checked) setText(termsError, '');
  });

  // 3D Secure: finestra nella pagina, non un popup del browser.
  const threeDsCode = h('input', { id: 'threeds-code', testid: 'threeds-code', inputmode: 'numeric', maxlength: '6', autocomplete: 'one-time-code' });
  const threeDsError = h('p', { class: 'field__error', testid: 'threeds-error' });
  const threeDsConfirm = h('button', { type: 'button', class: 'button', testid: 'threeds-confirm' }, 'Verifica');
  const threeDsCancel = h('button', { type: 'button', class: 'button button--secondary', testid: 'threeds-cancel' }, 'Annulla');
  const threeDs = h('div', { class: 'dialog-backdrop', hidden: true },
    h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'threeds-title', testid: 'threeds-dialog' },
      h('h2', { id: 'threeds-title' }, 'Verifica 3D Secure'),
      h('p', {}, 'La tua banca chiede di confermare il pagamento. Inserisci il codice ricevuto via SMS.'),
      h('label', { for: 'threeds-code' }, 'Codice di verifica'),
      threeDsCode,
      threeDsError,
      h('div', { class: 'actions' }, threeDsCancel, threeDsConfirm)));

  let busy = false;
  function setBusy(value: boolean): void {
    busy = value;
    processing.hidden = !value;
    if (!__BUG_B28__) payButton.disabled = value;
  }

  function complete(snapshot: { order: Order; totals: Totals; method: PaymentMethod }, giftPaid?: { code: string; balance: number }): void {
    if (giftPaid) saveGiftBalance(giftPaid.code, Math.max(0, giftPaid.balance - snapshot.totals.total));
    const code = newBookingCode();
    addBooking({
      code,
      showId: snapshot.order.showId,
      seats: sortSeats(snapshot.order.seats),
      types: snapshot.order.types,
      totals: snapshot.totals,
      paid: snapshot.totals.total,
      method: snapshot.method,
      status: snapshot.method === 'cassa' ? 'Da pagare in cassa' : 'Confermata',
      email: email.input.value.trim(),
      name: `${firstName.input.value.trim()} ${lastName.input.value.trim()}`,
      createdAt: Date.now(),
    });
    saveOrder(null);
    navigate(`/conferma?codice=${code}`);
  }

  payButton.addEventListener('click', () => {
    if (busy && !__BUG_B28__) return;
    hidePaymentError();
    const fields = [...buyerFields, ...(method === 'card' ? cardFields : method === 'gift' ? giftFields : [])];
    if (!check(fields)) return;
    if (method === 'cassa' && !cassaAvailable(count)) {
      showPaymentError(`Il pagamento in cassa è disponibile solo fino a ${CASSA_MAX_TICKETS} biglietti.`);
      return;
    }
    const snapshot = { order: { ...order }, totals, method };
    setBusy(true);
    window.setTimeout(() => {
      if (snapshot.method === 'cassa') return complete(snapshot);
      if (snapshot.method === 'gift') {
        const found = lookupGift(giftCode.input.value);
        if (!found.ok) {
          setBusy(false);
          return showPaymentError(found.message);
        }
        if (found.balance < snapshot.totals.total && !__BUG_B13__) {
          setBusy(false);
          return showPaymentError(`Saldo insufficiente: disponibili ${euro(found.balance)}.`);
        }
        return complete(snapshot, found);
      }
      const outcome = cardOutcome(cardNumber.input.value);
      if (outcome === 'declined') {
        setBusy(false);
        return showPaymentError('Pagamento rifiutato dalla banca.');
      }
      if (outcome === 'insufficient') {
        setBusy(false);
        return showPaymentError('Fondi insufficienti.');
      }
      if (outcome === '3ds') {
        threeDsCode.value = '';
        setText(threeDsError, '');
        threeDs.hidden = false;
        threeDsCode.focus();
        threeDsConfirm.onclick = () => {
          if (threeDsCode.value.trim() !== THREE_DS_CODE) {
            setText(threeDsError, 'Codice di verifica errato.');
            return;
          }
          threeDs.hidden = true;
          complete(snapshot);
        };
        threeDsCancel.onclick = () => {
          threeDs.hidden = true;
          setBusy(false);
          showPaymentError('Verifica 3D Secure annullata.');
        };
        return;
      }
      complete(snapshot);
    }, 1200);
  });

  const recapSeats = sortSeats(order.seats).map((s) => `${s} (${TICKET_LABELS[order.types[s] ?? 'intero']})`).join(', ');

  const el = h('div', { class: 'page page--checkout' },
    stepper(3),
    h('h1', {}, 'Pagamento'),
    h('div', { class: 'two-columns' },
      h('form', { class: 'checkout-form', novalidate: true, onSubmit: (e: Event) => e.preventDefault() },
        h('fieldset', {},
          h('legend', {}, 'Dati dell’acquirente'),
          h('div', { class: 'field-grid' }, firstName.wrap, lastName.wrap, email.wrap, emailConfirm.wrap, phone.wrap)),
        h('fieldset', {},
          h('legend', {}, 'Metodo di pagamento'),
          methodList,
          ...panels.values()),
        h('div', { class: 'field field--check' },
          h('label', { for: 'terms-accept' }, terms, 'Accetto le condizioni di vendita'),
          termsError),
        paymentError,
        // Lo stato "in corso" va sotto il pulsante: sopra lo sposterebbe in basso
        // mentre si clicca, e il secondo click di un doppio click cadrebbe altrove.
        payButton,
        processing),
      h('aside', { class: 'checkout-recap' },
        h('div', { class: 'recap-show', testid: 'checkout-show' },
          h('h2', {}, show.filmData.title),
          h('p', { testid: 'checkout-datetime' }, showLabel(show)),
          h('p', { testid: 'checkout-hall' }, `Sala ${show.hall} · ${show.format}`),
          h('p', { testid: 'checkout-seats' }, recapSeats)),
        summary.el,
        h('a', { class: 'back-link', href: `/biglietti?spettacolo=${encodeURIComponent(show.id)}`, testid: 'checkout-back' }, '← Modifica i biglietti'))),
    threeDs);

  selectMethod('card');
  return { title: 'Pagamento', el };
}
