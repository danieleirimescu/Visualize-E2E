// Prezzi in centesimi -> "9,50 €" (spazio normale, non quello non separabile di
// Intl, cosi' un test che confronta il testo non inciampa in U+00A0).
export function euro(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}

export function discountText(cents: number): string {
  return cents > 0 ? `-${euro(cents)}` : euro(0);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
