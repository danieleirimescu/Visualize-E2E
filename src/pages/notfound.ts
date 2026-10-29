import type { Page } from '../router';
import { messagePage } from './shared';

export function notFoundPage(): Page {
  return {
    title: 'Pagina non trovata',
    el: messagePage('Pagina non trovata', 'La pagina che cerchi non esiste.', 'page-not-found', { href: '/', label: 'Vai alla programmazione' }),
  };
}
