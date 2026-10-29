import { test as base, expect, type Page } from '@playwright/test';

// Orologio fisso: martedi 3 novembre 2026, ore 9:00 a Roma. Domani e' quindi
// mercoledi 4 novembre. I test che dipendono dall'ora la cambiano esplicitamente.
export const NOW = '2026-11-03T09:00:00+01:00';
export const TODAY = '20261103';
export const TOMORROW = '20261104';
export const TOMORROW_LABEL = 'mercoledì 4 novembre 2026';

export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date(NOW));
    await use(page);
  },
});
export { expect };

export const id = (testid: string) => `[data-testid="${testid}"]`;

/** Apre la mappa dei posti di uno spettacolo passando dalla programmazione. */
export async function openShow(page: Page, film: string, time: string, day = 1): Promise<void> {
  await page.goto(day ? `/?giorno=${day}` : '/');
  await page.getByTestId(`showtime-${film}-${time}`).click();
  await expect(page).toHaveURL(/\/posti\?spettacolo=/);
  await expect(page.getByTestId('seat-map')).toBeVisible();
}

export async function selectSeats(page: Page, seats: string[]): Promise<void> {
  for (const seat of seats) {
    await page.getByTestId(`seat-${seat}`).click();
    await expect(page.getByTestId(`seat-${seat}`)).toHaveClass(/is-selected/);
  }
}

export async function toTickets(page: Page): Promise<void> {
  await page.getByTestId('seats-continue').click();
  await expect(page).toHaveURL(/\/biglietti\?spettacolo=/);
}

export async function toCheckout(page: Page): Promise<void> {
  await page.getByTestId('tickets-continue').click();
  await expect(page).toHaveURL(/\/checkout$/);
}

/** Mappa delle file: 'X' occupato, '.' libero. */
export async function occupancy(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const rows: Record<string, string> = {};
    for (const b of document.querySelectorAll<HTMLElement>('.seat')) {
      const seat = b.dataset.testid!.replace(/^seat-/, '');
      rows[seat[0]] = (rows[seat[0]] ?? '') + (b.classList.contains('is-occupied') ? 'X' : '.');
    }
    return rows;
  });
}

/** Un posto libero della fila che, scelto da solo, non lascia posti isolati. */
export async function safeSeat(page: Page, row: string): Promise<string> {
  const line = (await occupancy(page))[row];
  for (let i = 0; i < line.length; i++) {
    const free = (j: number) => j < 0 || j >= line.length || line[j] === '.';
    const taken = (j: number) => j >= 0 && j < line.length && line[j] === 'X';
    if (line[i] !== '.') continue;
    const leftIsolated = i - 1 >= 0 && line[i - 1] === '.' && taken(i - 2);
    const rightIsolated = i + 1 < line.length && line[i + 1] === '.' && taken(i + 2);
    if (!leftIsolated && !rightIsolated && (free(i - 1) || free(i + 1))) return `${row}${i + 1}`;
  }
  throw new Error(`Nessun posto sicuro nella fila ${row}: ${line}`);
}

export async function fillBuyer(page: Page): Promise<void> {
  await page.getByTestId('buyer-first-name').fill('Ada');
  await page.getByTestId('buyer-last-name').fill('Lovelace');
  await page.getByTestId('buyer-email').fill('ada.lovelace@example.com');
  await page.getByTestId('buyer-email-confirm').fill('ada.lovelace@example.com');
  await page.getByTestId('terms-accept').check();
}

export async function fillCard(page: Page, number: string, expiry = '12/30', cvv = '123'): Promise<void> {
  await page.getByTestId('payment-method-card').check();
  await page.getByTestId('card-holder').fill('Ada Lovelace');
  await page.getByTestId('card-number').fill(number);
  await page.getByTestId('card-expiry').fill(expiry);
  await page.getByTestId('card-cvv').fill(cvv);
}

export async function pay(page: Page): Promise<void> {
  await page.getByTestId('pay-button').click();
}

/** Prenota e paga con la carta 4242: restituisce il codice di prenotazione. */
export async function book(page: Page, film: string, time: string, seats: string[], day = 1): Promise<string> {
  await openShow(page, film, time, day);
  await selectSeats(page, seats);
  await toTickets(page);
  await toCheckout(page);
  await fillBuyer(page);
  await fillCard(page, '4242 4242 4242 4242');
  await pay(page);
  await expect(page).toHaveURL(/\/conferma\?codice=VZ-/);
  return (await page.getByTestId('booking-code').textContent())!.trim();
}
