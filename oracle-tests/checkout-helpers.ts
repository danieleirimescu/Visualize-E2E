import type { Page } from '@playwright/test';
import { openShow, selectSeats, toTickets, toCheckout } from './helpers';

export * from './helpers';

export const flow = {
  /** Prenota domani Il faro sommerso delle 20:30 sui posti dati e arriva al checkout. */
  async toCheckoutWith(page: Page, seats: string[]): Promise<void> {
    await openShow(page, 'il-faro-sommerso', '2030');
    await selectSeats(page, seats);
    await toTickets(page);
    await toCheckout(page);
  },
};
