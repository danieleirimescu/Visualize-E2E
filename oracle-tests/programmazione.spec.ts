import { test, expect, TOMORROW_LABEL } from './helpers';

const FILMS = ['il-faro-sommerso', 'luci-di-marte', 'la-citta-di-vetro', 'ultimo-treno-per-orione', 'piccoli-giganti', 'notte-a-ponente'];

test('sette schede da oggi', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 7; i++) await expect(page.getByTestId(`day-tab-${i}`)).toBeVisible();
  await expect(page.getByTestId('day-tab-7')).toHaveCount(0);
  await expect(page.getByTestId('day-tab-0')).toHaveText('Oggi');
  await expect(page.getByTestId('day-tab-1')).toHaveText('Domani');
  await expect(page.getByTestId('selected-day-label')).toHaveText('martedì 3 novembre 2026');
});

test('filtro per formato 3D', async ({ page }) => {
  await page.goto('/?giorno=1');
  await page.getByTestId('filter-format').selectOption('3D');
  await expect(page).toHaveURL(/formato=3D/);
  await expect(page.getByTestId('showtime-ultimo-treno-per-orione-2250')).toBeVisible();
  await expect(page.getByTestId('showtime-ultimo-treno-per-orione-1500')).toHaveCount(0);
  await expect(page.getByTestId('film-card-il-faro-sommerso')).toHaveCount(0);
  for (const detail of await page.locator('.showtime__detail').allTextContents()) expect(detail).toContain('3D');
});

test('filtro per genere', async ({ page }) => {
  await page.goto('/?giorno=1');
  await page.getByTestId('filter-genre').selectOption('Horror');
  await expect(page.getByTestId('film-card-notte-a-ponente')).toBeVisible();
  await expect(page.locator('[data-testid^="film-card-"]')).toHaveCount(1);
});

test('durata uguale fra programmazione e scheda', async ({ page }) => {
  await page.goto('/?giorno=1');
  const durations: Record<string, string> = {};
  for (const slug of FILMS) durations[slug] = (await page.getByTestId(`film-duration-${slug}`).textContent())!;
  for (const slug of FILMS) {
    await page.goto(`/film/${slug}`);
    await expect(page.getByTestId('film-duration')).toHaveText(durations[slug]);
  }
});

test("l'orario di domani apre lo spettacolo di domani", async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('day-tab-1').click();
  await expect(page).toHaveURL(/giorno=1/);
  await page.getByTestId('showtime-il-faro-sommerso-2030').click();
  await expect(page.getByTestId('show-datetime')).toHaveText(`${TOMORROW_LABEL}, 20:30`);
  await expect(page.getByTestId('show-hall')).toHaveText('Sala 1');
});

test('spettacolo esaurito non prenotabile', async ({ page }) => {
  await page.goto('/?giorno=1');
  const soldOut = page.getByTestId('showtime-piccoli-giganti-1600');
  await expect(soldOut).toContainText('Esaurito');
  await expect(soldOut).toHaveAttribute('aria-disabled', 'true');
  expect(await soldOut.evaluate((el) => el.tagName)).toBe('SPAN');
});

test('scheda film con orari dei sette giorni', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('film-title-luci-di-marte').click();
  await expect(page).toHaveURL(/\/film\/luci-di-marte$/);
  await expect(page.getByTestId('film-title')).toHaveText('Luci di Marte');
  for (let i = 0; i < 7; i++) await expect(page.getByTestId(`film-schedule-day-${i}`)).toBeVisible();
  await page.getByTestId('film-schedule-day-1').getByTestId('showtime-1-2030').click();
  await expect(page.getByTestId('show-datetime')).toHaveText(`${TOMORROW_LABEL}, 20:30`);
});
