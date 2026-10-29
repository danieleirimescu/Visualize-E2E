import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const path = (...parts) => resolve(ROOT, ...parts);

// Le CLI si lanciano con node direttamente, senza shell: su Windows npx passa per
// cmd.exe, che spezza gli argomenti con spazi (i titoli dei test in -g).
export const VITE = path('node_modules', 'vite', 'bin', 'vite.js');
export const PLAYWRIGHT = path('node_modules', '@playwright', 'test', 'cli.js');

export const readJson = (file) => JSON.parse(readFileSync(path(file), 'utf8'));

export function catalog() {
  return readJson('bugs/catalog.json').entries;
}

export function profile() {
  return readJson('domain/visualize.base.json');
}

export function releases() {
  return readdirSync(path('releases'))
    .filter((f) => /^r\d+\.json$/.test(f))
    .sort()
    .map((f) => readJson(`releases/${f}`));
}

export function release(id) {
  const file = `releases/${id}.json`;
  if (!existsSync(path(file))) throw new Error(`Release sconosciuta: ${id}`);
  return readJson(file);
}

// Stesse regole di graph/nodes/reflector_consolidate_insights/reflector_node.py
// (_quote_tokens, _SENTENCE_END_PATTERN): una frase del catalogo deve essere una
// frase intera del profilo come la vede il controllo delle citazioni del triage.
const SENTENCE_END = /(?<![\d.])[.!?。！？](?![\d.])|\n/;
export function quoteTokens(text) {
  const folded = String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  return (folded.match(/[\p{L}\p{N}]+|[$€£¥%]/gu) ?? []).join(' ');
}
export function sentences(text) {
  return String(text ?? '').trim().split(SENTENCE_END).map(quoteTokens).filter(Boolean);
}
export function profileSentences(p = profile()) {
  const entries = [...(p.business_rules ?? []), ...(p.workflows ?? []).map((w) => w.expected_behavior ?? '')];
  return new Set(entries.flatMap(sentences));
}
export function quoteIsWholeSentences(quote, set = profileSentences()) {
  const parts = String(quote ?? '').split(SENTENCE_END).filter((part) => quoteTokens(part));
  // Come _quoted_sentence_found: un'etichetta prima dei due punti ("Regola: ...")
  // e' ammessa, conta solo la parte dopo.
  const found = (part) => {
    if (set.has(quoteTokens(part))) return true;
    const colon = part.indexOf(':');
    return colon > 0 && part.slice(0, colon).trim() !== '' && set.has(quoteTokens(part.slice(colon + 1)));
  };
  return parts.length > 0 && parts.every(found);
}

/** Frasi di `quote` (normalizzate) che sono frasi intere del profilo, etichetta ammessa. */
export function quotedSentences(quote) {
  return String(quote ?? '').split(SENTENCE_END).filter((part) => quoteTokens(part)).flatMap((part) => {
    const colon = part.indexOf(':');
    return colon > 0 ? [quoteTokens(part), quoteTokens(part.slice(colon + 1))] : [quoteTokens(part)];
  });
}

// I timestamp della memoria di LABBGEN senza fuso sono ora di Roma
// (memory/service.py::_utcnow): letti come ora locale sbaglierebbero fuori da Roma.
export function parseMemoryTimestamp(value) {
  const text = String(value ?? '');
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(text)) return new Date(text);
  const asUtc = new Date(`${text}Z`);
  const romeAsUtc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const utcAsUtc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(asUtc.getTime() - (romeAsUtc.getTime() - utcAsUtc.getTime()));
}

export function testTitles() {
  const titles = new Set();
  for (const file of readdirSync(path('oracle-tests')).filter((f) => f.endsWith('.spec.ts'))) {
    const source = readFileSync(path('oracle-tests', file), 'utf8');
    for (const m of source.matchAll(/^test\((['"`])(.+?)\1,/gm)) titles.add(m[2]);
  }
  return titles;
}

export function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
