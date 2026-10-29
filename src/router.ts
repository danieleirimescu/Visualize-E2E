export interface Page {
  title: string;
  el: HTMLElement;
  dispose?: () => void;
}

export type PageFactory = (params: Record<string, string>, query: URLSearchParams) => Page;

interface Route {
  pattern: RegExp;
  keys: string[];
  page: PageFactory;
}

const routes: Route[] = [];
let notFound: PageFactory;
let current: Page | undefined;
let mount: (page: Page) => void;

export function route(path: string, page: PageFactory): void {
  const keys: string[] = [];
  const source = path.replace(/:(\w+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  routes.push({ pattern: new RegExp(`^${source}/?$`), keys, page });
}

export function fallback(page: PageFactory): void {
  notFound = page;
}

export function navigate(url: string, replace = false): void {
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  render();
}

export function render(): void {
  current?.dispose?.();
  const query = new URLSearchParams(location.search);
  let page: Page | undefined;
  for (const r of routes) {
    const match = r.pattern.exec(location.pathname);
    if (!match) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
    page = r.page(params, query);
    break;
  }
  current = page ?? notFound({}, query);
  document.title = `${current.title} · Visualize`;
  mount(current);
  window.scrollTo(0, 0);
}

export function start(onMount: (page: Page) => void): void {
  mount = onMount;
  // I link interni sono veri <a href>: il click li intercetta per non ricaricare
  // la pagina, ma ogni pagina resta raggiungibile anche aprendo l'URL.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element | null)?.closest?.('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search);
  });
  window.addEventListener('popstate', render);
  render();
}
