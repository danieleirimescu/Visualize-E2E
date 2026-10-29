import { test, expect, openShow, selectSeats, toTickets, safeSeat } from './helpers';

async function summary(page: import('@playwright/test').Page) {
  const read = async (t: string) => (await page.getByTestId(t).textContent())!.trim();
  return {
    count: await read('summary-count'),
    tickets: await read('summary-tickets'),
    supplements: await read('summary-supplements'),
    fee: await read('summary-fee'),
    discount: await read('summary-discount'),
    total: await read('summary-total'),
  };
}

test('prezzo di ogni tipologia di biglietto', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A1', 'A2', 'A3', 'A4']);
  await toTickets(page);
  await page.getByTestId('ticket-type-A2').selectOption('ridotto');
  await page.getByTestId('ticket-type-A3').selectOption('bambini');
  await page.getByTestId('ticket-type-A4').selectOption('studente');
  await expect(page.getByTestId('ticket-price-A1')).toHaveText('9,50 €');
  await expect(page.getByTestId('ticket-price-A2')).toHaveText('7,00 €');
  await expect(page.getByTestId('ticket-price-A3')).toHaveText('6,00 €');
  await expect(page.getByTestId('ticket-price-A4')).toHaveText('7,50 €');
  await expect(page.getByTestId('summary-tickets')).toHaveText('30,00 €');
  await expect(page.getByTestId('summary-total')).toHaveText('33,20 €');
});

test('il numero di biglietti è uguale ai posti', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['B2', 'B3', 'B4']);
  await toTickets(page);
  await expect(page.locator('[data-testid^="ticket-row-"]')).toHaveCount(3);
  await expect(page.getByTestId('summary-count')).toHaveText('3 biglietti');
});

test('spettacolo 3D: supplemento nel totale', async ({ page }) => {
  await openShow(page, 'luci-di-marte', '2030');
  await selectSeats(page, ['A5']);
  await toTickets(page);
  await expect(page.getByTestId('ticket-price-A5')).toHaveText('11,50 €');
  expect(await summary(page)).toEqual({
    count: '1 biglietto', tickets: '9,50 €', supplements: '2,00 €', fee: '0,80 €', discount: '0,00 €', total: '12,30 €',
  });
});

test('commissione per ogni biglietto', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A1', 'A2']);
  await toTickets(page);
  await expect(page.getByTestId('summary-fee')).toHaveText('1,60 €');
  await expect(page.getByTestId('summary-total')).toHaveText('20,60 €');
});

test('codice promozionale applicato una sola volta', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A1']);
  await toTickets(page);
  await page.getByTestId('promo-code').fill('VISUALIZE15');
  await page.getByTestId('promo-apply').click();
  await expect(page.getByTestId('promo-message')).toContainText('applicato');
  await expect(page.getByTestId('summary-discount')).toHaveText('-1,43 €');
  await page.getByTestId('promo-apply').click();
  await expect(page.getByTestId('promo-message')).toHaveText('Il codice è già stato applicato.');
  await expect(page.getByTestId('summary-discount')).toHaveText('-1,43 €');
  await expect(page.getByTestId('summary-total')).toHaveText('8,87 €');
});

test('codice promozionale non valido', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A1']);
  await toTickets(page);
  await page.getByTestId('promo-code').fill('SCONTO50');
  await page.getByTestId('promo-apply').click();
  await expect(page.getByTestId('promo-message')).toHaveText('Codice promozionale non valido.');
  await expect(page.getByTestId('summary-discount')).toHaveText('0,00 €');
});

test('sconto VISUALIZE15 esclusa la commissione', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A1', 'A2']);
  await toTickets(page);
  await page.getByTestId('promo-code').fill('visualize15');
  await page.getByTestId('promo-apply').click();
  expect(await summary(page)).toEqual({
    count: '2 biglietti', tickets: '19,00 €', supplements: '0,00 €', fee: '1,60 €', discount: '-2,85 €', total: '17,75 €',
  });
});

test('arrotondamento dello sconto', async ({ page }) => {
  // 15% di 9,50 = 1,425: arrotondato al centesimo, per eccesso sul mezzo centesimo.
  await openShow(page, 'il-faro-sommerso', '1730');
  await selectSeats(page, ['B5']);
  await toTickets(page);
  await page.getByTestId('promo-code').fill('VISUALIZE15');
  await page.getByTestId('promo-apply').click();
  await expect(page.getByTestId('summary-discount')).toHaveText('-1,43 €');
});

test('film VM14 senza tariffa Bambini', async ({ page }) => {
  await openShow(page, 'la-citta-di-vetro', '2240');
  await selectSeats(page, ['A1']);
  await toTickets(page);
  const options = await page.getByTestId('ticket-type-A1').locator('option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(options).toEqual(['intero', 'ridotto', 'studente']);
});

test('supplemento poltrona VIP', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  const seat = await safeSeat(page, 'H');
  await selectSeats(page, [seat]);
  await toTickets(page);
  await expect(page.getByTestId(`ticket-price-${seat}`)).toHaveText('12,50 €');
  await expect(page.getByTestId('summary-supplements')).toHaveText('3,00 €');
  await expect(page.getByTestId('summary-total')).toHaveText('13,30 €');
});
