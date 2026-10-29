type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown>;

// h('button', { class: 'x', testid: 'pay-button', onClick: fn }, 'Paga')
// `testid` diventa data-testid; on<Evento> registra un listener; false/null/undefined
// omettono l'attributo.
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'testid') {
      el.setAttribute('data-testid', String(value));
    } else if (key === 'class') {
      el.className = String(value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  append(el, ...children);
  return el;
}

export function append(el: Element, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
}

export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}
