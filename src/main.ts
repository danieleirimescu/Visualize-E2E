import './styles.css';
import { h, setText } from './ui/dom';
import { start, route, fallback, type Page } from './router';
import { loadOrder } from './domain/store';
import { findShow } from './domain/films';
import { plural } from './ui/format';
import { homePage } from './pages/home';
import { filmPage } from './pages/film';
import { seatsPage } from './pages/seats';
import { ticketsPage } from './pages/tickets';
import { checkoutPage } from './pages/checkout';
import { confirmPage } from './pages/confirm';
import { bookingsPage } from './pages/bookings';
import { pricesPage } from './pages/prices';
import { notFoundPage } from './pages/notfound';

route('/', homePage);
route('/film/:slug', filmPage);
route('/posti', seatsPage);
route('/biglietti', ticketsPage);
route('/checkout', checkoutPage);
route('/conferma', confirmPage);
route('/prenotazioni', bookingsPage);
route('/prezzi', pricesPage);
fallback(notFoundPage);

const orderLink = h('a', { class: 'header-order', testid: 'header-order', href: '/' });

function refreshOrderLink(): void {
  const order = loadOrder();
  const show = order && order.seats.length ? findShow(order.showId) : undefined;
  if (!order || !show) {
    orderLink.hidden = true;
    return;
  }
  orderLink.hidden = false;
  orderLink.setAttribute('href', `/posti?spettacolo=${encodeURIComponent(show.id)}`);
  setText(orderLink, `Ordine in corso: ${plural(order.seats.length, 'posto', 'posti')}`);
}

const navLinks = [
  h('a', { href: '/', testid: 'nav-programmazione' }, 'Programmazione'),
  h('a', { href: '/prezzi', testid: 'nav-prezzi' }, 'Prezzi'),
  h('a', { href: '/prenotazioni', testid: 'nav-prenotazioni' }, 'Le mie prenotazioni'),
];

const main = h('main', { id: 'main', class: 'main' });

const shell = h('div', { class: 'shell' },
  h('header', { class: 'site-header' },
    h('div', { class: 'site-header__inner' },
      h('a', { href: '/', class: 'brand', testid: 'brand-home', 'aria-label': 'Visualize, torna alla programmazione' },
        h('span', { class: 'brand__mark', 'aria-hidden': 'true' }, 'V'), 'Visualize'),
      h('nav', { class: 'site-nav', 'aria-label': 'Navigazione principale' }, ...navLinks),
      orderLink)),
  main,
  h('footer', { class: 'site-footer' },
    h('p', {}, 'Visualize è un sito dimostrativo per test automatici end-to-end. Film, sale e prezzi sono inventati e nessun pagamento è reale.')));

document.getElementById('app')!.replaceWith(shell);

function highlightNav(): void {
  const path = location.pathname;
  for (const link of navLinks) {
    const href = link.getAttribute('href')!;
    const active = href === '/' ? path === '/' || path.startsWith('/film/') : path.startsWith(href);
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

window.addEventListener('vz:order', refreshOrderLink);

start((page: Page) => {
  main.replaceChildren(page.el);
  highlightNav();
  refreshOrderLink();
});
