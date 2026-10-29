import { test, expect, openShow, selectSeats, toTickets, toCheckout, fillBuyer, fillCard, pay, flow } from './checkout-helpers';

test('campi obbligatori e email di conferma', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1']);
  await page.getByTestId('payment-method-card').check();
  await pay(page);
  await expect(page.getByTestId('buyer-first-name-error')).toHaveText('Campo obbligatorio.');
  await expect(page.getByTestId('buyer-email-error')).toHaveText('Campo obbligatorio.');
  await expect(page.getByTestId('terms-accept-error')).toHaveText('Devi accettare le condizioni di vendita.');
  await expect(page.getByTestId('card-number-error')).toHaveText('Campo obbligatorio.');
  await page.getByTestId('buyer-email').fill('ada@example.com');
  await page.getByTestId('buyer-email-confirm').fill('ada@esempio.com');
  await pay(page);
  await expect(page.getByTestId('buyer-email-confirm-error')).toHaveText('Le email non coincidono.');
  await expect(page).toHaveURL(/\/checkout$/);
});

test('numero di carta non valido', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1']);
  await fillBuyer(page);
  await fillCard(page, '4242 4242 4242 4241');
  await pay(page);
  await expect(page.getByTestId('card-number-error')).toHaveText('Numero di carta non valido.');
  await expect(page).toHaveURL(/\/checkout$/);
});

test('carte rifiutate e 3D Secure', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1']);
  await fillBuyer(page);
  await fillCard(page, '4000 0000 0000 0002');
  await pay(page);
  await expect(page.getByTestId('payment-error')).toHaveText('Pagamento rifiutato dalla banca.');
  await fillCard(page, '4000 0000 0000 9995');
  await pay(page);
  await expect(page.getByTestId('payment-error')).toHaveText('Fondi insufficienti.');
  await fillCard(page, '4000 0000 0000 3220');
  await pay(page);
  await expect(page.getByTestId('threeds-dialog')).toBeVisible();
  await page.getByTestId('threeds-code').fill('000000');
  await page.getByTestId('threeds-confirm').click();
  await expect(page.getByTestId('threeds-error')).toHaveText('Codice di verifica errato.');
  await page.getByTestId('threeds-code').fill('123456');
  await page.getByTestId('threeds-confirm').click();
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
  await expect(page.getByTestId('booking-status')).toHaveText('Confermata');
});

test('carta che scade nel mese corrente', async ({ page }) => {
  // L'orologio dei test e' a novembre 2026.
  await flow.toCheckoutWith(page, ['A1']);
  await fillBuyer(page);
  await fillCard(page, '4242 4242 4242 4242', '10/26');
  await pay(page);
  await expect(page.getByTestId('card-expiry-error')).toHaveText('La carta è scaduta.');
  await page.getByTestId('card-expiry').fill('11/26');
  await pay(page);
  await expect(page.getByTestId('card-expiry-error')).toHaveText('');
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
});

test('carta American Express', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1']);
  await fillBuyer(page);
  await fillCard(page, '378282246310005', '12/30', '1234');
  await expect(page.getByTestId('card-number')).toHaveValue('3782 822463 10005');
  await pay(page);
  await expect(page.getByTestId('card-cvv-error')).toHaveText('');
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
});

test('pagamento in cassa senza commissione', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1', 'A2']);
  await expect(page.getByTestId('summary-fee')).toHaveText('1,60 €');
  await page.getByTestId('payment-method-cassa').check();
  await expect(page.getByTestId('cassa-note')).toBeVisible();
  await expect(page.getByTestId('card-number')).toBeHidden();
  await expect(page.getByTestId('summary-fee')).toHaveText('0,00 €');
  await expect(page.getByTestId('summary-total')).toHaveText('19,00 €');
  await fillBuyer(page);
  await pay(page);
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
  await expect(page.getByTestId('booking-status')).toHaveText('Da pagare in cassa');
  await expect(page.getByTestId('booking-total')).toHaveText('19,00 €');
});

test('pagamento in cassa solo fino a 4 biglietti', async ({ page }) => {
  await flow.toCheckoutWith(page, ['B1', 'B2', 'B3', 'B4']);
  await expect(page.getByTestId('payment-method-cassa')).toBeEnabled();
  // Un altro spettacolo, cosi' la selezione precedente non si somma.
  await openShow(page, 'il-faro-sommerso', '1730');
  await selectSeats(page, ['B1', 'B2', 'B3', 'B4', 'B5']);
  await toTickets(page);
  await toCheckout(page);
  await expect(page.getByTestId('payment-method-cassa')).toBeDisabled();
  await expect(page.getByTestId('cassa-unavailable')).toHaveText('Il pagamento in cassa è disponibile solo fino a 4 biglietti.');
});

test('carta regalo con saldo insufficiente', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1', 'A2']);
  await fillBuyer(page);
  await page.getByTestId('payment-method-gift').check();
  await page.getByTestId('gift-code').fill('GIFT-1000-0000-0002');
  await pay(page);
  await expect(page.getByTestId('payment-processing')).toBeHidden();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId('payment-error')).toHaveText('Saldo insufficiente: disponibili 10,00 €.');
});

test('carta regalo: formato, scaduta, saldo ridotto', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1', 'A2']);
  await fillBuyer(page);
  await page.getByTestId('payment-method-gift').check();
  await page.getByTestId('gift-code').fill('GIFT-12');
  await pay(page);
  await expect(page.getByTestId('gift-code-error')).toHaveText('Formato del codice non valido.');
  await page.getByTestId('gift-code').fill('GIFT-0000-0000-0003');
  await pay(page);
  await expect(page.getByTestId('payment-error')).toHaveText('Carta regalo scaduta.');
  await page.getByTestId('gift-code').fill('GIFT-5000-0000-0001');
  await pay(page);
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
  // 50,00 - 20,60 = 29,40: un secondo ordine da 20,60 passa, un terzo no.
  await flow.toCheckoutWith(page, ['B1', 'B2']);
  await fillBuyer(page);
  await page.getByTestId('payment-method-gift').check();
  await page.getByTestId('gift-code').fill('GIFT-5000-0000-0001');
  await pay(page);
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
  await flow.toCheckoutWith(page, ['A9', 'A10']);
  await fillBuyer(page);
  await page.getByTestId('payment-method-gift').check();
  await page.getByTestId('gift-code').fill('GIFT-5000-0000-0001');
  await pay(page);
  await expect(page.getByTestId('payment-error')).toHaveText('Saldo insufficiente: disponibili 8,80 €.');
});

test('un pagamento crea una sola prenotazione', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1']);
  await fillBuyer(page);
  await fillCard(page, '4242 4242 4242 4242');
  await page.getByTestId('pay-button').dblclick();
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
  // Lascia arrivare in fondo anche un eventuale secondo pagamento partito dal doppio click.
  await page.waitForTimeout(1500);
  await page.goto('/prenotazioni');
  await expect(page.getByTestId('booking-item')).toHaveCount(1);
});

test('pulsante di pagamento disabilitato durante il pagamento', async ({ page }) => {
  await flow.toCheckoutWith(page, ['A1']);
  await fillBuyer(page);
  await fillCard(page, '4242 4242 4242 4242');
  await pay(page);
  await expect(page.getByTestId('payment-processing')).toBeVisible();
  await expect(page.getByTestId('pay-button')).toBeDisabled();
});

test('conferma con lo stesso totale pagato', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A1']);
  await toTickets(page);
  await page.getByTestId('promo-code').fill('VISUALIZE15');
  await page.getByTestId('promo-apply').click();
  await toCheckout(page);
  await expect(page.getByTestId('summary-total')).toHaveText('8,87 €');
  await fillBuyer(page);
  await fillCard(page, '4242 4242 4242 4242');
  await pay(page);
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
  await expect(page.getByTestId('booking-total')).toHaveText('8,87 €');
});
