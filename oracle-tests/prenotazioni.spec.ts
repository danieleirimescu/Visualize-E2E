import { test, expect, book, openShow, TOMORROW_LABEL } from './helpers';
import type { Page } from '@playwright/test';

const item = (page: Page, code: string) => page.locator(`[data-testid="booking-item"][data-code="${code}"]`);

test('le mie prenotazioni con data e ora dello spettacolo', async ({ page }) => {
  const code = await book(page, 'il-faro-sommerso', '2030', ['A1', 'A2']);
  await expect(page.getByTestId('booking-datetime')).toHaveText(`${TOMORROW_LABEL}, 20:30`);
  await page.getByTestId('confirm-bookings').click();
  await expect(page).toHaveURL(/\/prenotazioni$/);
  await expect(item(page, code).getByTestId('booking-date')).toHaveText(`${TOMORROW_LABEL}, 20:30`);
  await expect(item(page, code).getByTestId('booking-seats')).toHaveText('A1, A2');
  await expect(item(page, code).getByTestId('booking-total')).toHaveText('20,60 €');
  await expect(item(page, code).getByTestId('booking-status')).toHaveText('Confermata');
});

test('i posti prenotati risultano occupati', async ({ page }) => {
  await book(page, 'il-faro-sommerso', '2030', ['A1', 'A2']);
  await openShow(page, 'il-faro-sommerso', '2030');
  await expect(page.getByTestId('seat-A1')).toHaveClass(/is-occupied/);
  await expect(page.getByTestId('seat-A2')).toHaveClass(/is-occupied/);
  await expect(page.getByTestId('seat-A3')).not.toHaveClass(/is-occupied/);
  await openShow(page, 'il-faro-sommerso', '1730');
  await expect(page.getByTestId('seat-A1')).not.toHaveClass(/is-occupied/);
});

test('annullare libera i posti', async ({ page }) => {
  const code = await book(page, 'il-faro-sommerso', '2030', ['A1', 'A2']);
  await page.goto('/prenotazioni');
  await item(page, code).getByTestId('booking-cancel').click();
  await item(page, code).getByTestId('booking-cancel-confirm').click();
  await expect(item(page, code).getByTestId('booking-status')).toHaveText('Annullata');
  await expect(item(page, code).getByTestId('booking-cancel')).toHaveCount(0);
  await openShow(page, 'il-faro-sommerso', '2030');
  await expect(page.getByTestId('seat-A1')).not.toHaveClass(/is-occupied/);
  await expect(page.getByTestId('seat-A2')).not.toHaveClass(/is-occupied/);
});

test("annullamento possibile fino a un'ora prima", async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T19:00:00+01:00'));
  const code = await book(page, 'il-faro-sommerso', '2030', ['A1'], 0);
  await page.goto('/prenotazioni');
  await expect(item(page, code).getByTestId('booking-cancel')).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-03T19:31:00+01:00'));
  await page.reload();
  await expect(item(page, code).getByTestId('booking-cancel')).toHaveCount(0);
  await expect(item(page, code).getByTestId('booking-not-cancellable')).toBeVisible();
});

test('nessuna prenotazione in un browser nuovo', async ({ page }) => {
  await page.goto('/prenotazioni');
  await expect(page.getByTestId('bookings-empty')).toBeVisible();
});
