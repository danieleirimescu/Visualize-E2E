import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Ogni voce del catalogo diventa una costante di build `__BUG_<ID>__` (true/false).
// Il minificatore elimina i rami delle mutazioni spente, quindi nel JS pubblicato
// non restano ne' il codice ne' i nomi dei bug inattivi.
//
// Quali voci sono accese:
//   - BUGS=B01,B07   elenco esplicito (usato dal controllo dei mutanti)
//   - RELEASE=r03    manifest releases/r03.json
//   - altrimenti     il file CURRENT_RELEASE, e in sua assenza r00 (pulita)
function activeIds(catalogIds: string[]): { release: string; ids: string[] } {
  const explicit = process.env.BUGS;
  if (explicit !== undefined) {
    const ids = explicit.split(',').map((s) => s.trim()).filter(Boolean);
    return { release: `custom:${ids.join('+') || 'none'}`, ids };
  }
  const fromFile = existsSync('CURRENT_RELEASE') ? readFileSync('CURRENT_RELEASE', 'utf8').trim() : '';
  const release = process.env.RELEASE || fromFile || 'r00';
  const manifestPath = resolve('releases', `${release}.json`);
  if (!existsSync(manifestPath)) throw new Error(`Manifest di release mancante: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const ids = [...(manifest.bugs ?? []), ...(manifest.changes ?? [])];
  for (const id of ids) {
    if (!catalogIds.includes(id)) throw new Error(`La release ${release} cita ${id}, che non e' nel catalogo`);
  }
  return { release, ids };
}

const catalog = JSON.parse(readFileSync(resolve('bugs', 'catalog.json'), 'utf8'));
const catalogIds: string[] = catalog.entries.map((e: { id: string }) => e.id);
const { release, ids } = activeIds(catalogIds);
for (const id of ids) {
  if (!catalogIds.includes(id)) throw new Error(`Voce sconosciuta: ${id}`);
}

const define: Record<string, string> = {};
for (const id of catalogIds) define[`__BUG_${id}__`] = JSON.stringify(ids.includes(id));

// Su Netlify i log di build sono visibili a chi ha accesso al sito: li si lascia
// senza l'elenco delle mutazioni.
// eslint-disable-next-line no-console
if (!process.env.NETLIFY) console.log(`[visualize] build ${release}: ${ids.length ? ids.join(', ') : 'nessuna mutazione'}`);

export default defineConfig({
  define,
  build: {
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
  },
  preview: { port: 4173, strictPort: true },
});
