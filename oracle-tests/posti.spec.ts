import { test, expect, openShow, selectSeats, toTickets, occupancy } from './helpers';

test('selezione e deselezione aggiornano contatore ed elenco', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await expect(page.getByTestId('selected-count')).toHaveText('0');
  await expect(page.getByTestId('seats-continue')).toBeDisabled();
  await selectSeats(page, ['A3', 'A1', 'A2']);
  await expect(page.getByTestId('selected-count')).toHaveText('3');
  await expect(page.getByTestId('selected-seats')).toHaveText('A1, A2, A3');
  await page.getByTestId('seat-A3').click();
  await expect(page.getByTestId('seat-A3')).not.toHaveClass(/is-selected/);
  await expect(page.getByTestId('selected-count')).toHaveText('2');
  await expect(page.getByTestId('selected-seats')).toHaveText('A1, A2');
});

test('posti occupati fissi non selezionabili', async ({ page }) => {
  await openShow(page, 'luci-di-marte', '2030');
  const rows = await occupancy(page);
  expect(rows.A).toBe('..........');
  expect(rows.B).toBe('..........');
  expect(rows.E.slice(3, 7)).toBe('XXXX');
  await page.getByTestId('seat-E5').click();
  await expect(page.getByTestId('seat-error')).toHaveText('Il posto E5 è occupato.');
  await expect(page.getByTestId('seat-E5')).not.toHaveClass(/is-selected/);
  await expect(page.getByTestId('selected-count')).toHaveText('0');
});

test('al massimo 8 posti', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8']);
  await page.getByTestId('seat-B9').click();
  await expect(page.getByTestId('seat-error')).toHaveText('Puoi selezionare al massimo 8 posti.');
  await expect(page.getByTestId('seat-B9')).not.toHaveClass(/is-selected/);
  await page.getByTestId('seat-B10').click();
  await expect(page.getByTestId('seat-B10')).not.toHaveClass(/is-selected/);
  await expect(page.locator('.seat.is-selected')).toHaveCount(8);
});

test('nessun posto singolo isolato', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A1', 'A3']);
  await page.getByTestId('seats-continue').click();
  await expect(page).toHaveURL(/\/posti\?/);
  await expect(page.getByTestId('seat-error')).toContainText('posto singolo isolato (A2)');
  await page.getByTestId('seat-A2').click();
  await toTickets(page);
});

test('un altro spettacolo azzera la selezione', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A5', 'A6']);
  await openShow(page, 'il-faro-sommerso', '1730');
  await expect(page.getByTestId('selected-count')).toHaveText('0');
  await expect(page.getByTestId('seat-A5')).not.toHaveClass(/is-selected/);
  await expect(page.getByTestId('header-order')).toBeHidden();
});

test('tornare ai posti mantiene la selezione', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await selectSeats(page, ['A5', 'A6']);
  await toTickets(page);
  await page.getByTestId('ticket-type-A6').selectOption('ridotto');
  await page.getByTestId('tickets-back').click();
  await expect(page).toHaveURL(/\/posti\?/);
  await expect(page.getByTestId('selected-count')).toHaveText('2');
  await expect(page.getByTestId('selected-seats')).toHaveText('A5, A6');
  await expect(page.getByTestId('seat-A5')).toHaveClass(/is-selected/);
  await toTickets(page);
  await expect(page.getByTestId('ticket-type-A6')).toHaveValue('ridotto');
});

test('spettacolo appena iniziato non prenotabile', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T20:35:00+01:00'));
  await page.goto('/');
  const started = page.getByTestId('showtime-il-faro-sommerso-2030');
  await expect(started).toContainText('Iniziato');
  expect(await started.evaluate((el) => el.tagName)).toBe('SPAN');
  await expect(page.getByTestId('showtime-notte-a-ponente-2250')).toHaveAttribute('href', /posti/);
  await page.goto('/posti?spettacolo=il-faro-sommerso.20261103.2030');
  await expect(page.getByTestId('show-unavailable')).toHaveText('Lo spettacolo è già iniziato e non è più prenotabile.');
  await expect(page.getByTestId('seat-map')).toHaveCount(0);
});

test('indicatore di ordine in corso', async ({ page }) => {
  await openShow(page, 'il-faro-sommerso', '2030');
  await expect(page.getByTestId('header-order')).toBeHidden();
  await selectSeats(page, ['A5', 'A6']);
  await expect(page.getByTestId('header-order')).toHaveText('Ordine in corso: 2 posti');
});
