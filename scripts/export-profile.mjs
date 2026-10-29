// Scrive il profilo di dominio per la pipeline LABBGEN aggiungendo l'origine del SUT.
//
//   node scripts/export-profile.mjs --origin https://visualize-cinema.netlify.app --out ../MALLM_Agent_ASK/domain/visualize.json
//   node scripts/export-profile.mjs --origin http://localhost:4173 --out ../MALLM_Agent_ASK/domain/visualize.local.json
//
// L'origine deve essere esattamente quella di TARGET_APP_URL (schema, host e
// porta, senza redirect): lo Scout rifiuta l'esplorazione se non coincide.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { profile, arg } from './lib.mjs';

const origin = arg('origin');
if (typeof origin !== 'string') {
  console.error('Uso: node scripts/export-profile.mjs --origin <https://host> [--out <file>]');
  process.exit(2);
}
const url = new URL(origin);
if (url.pathname !== '/' || url.search || url.hash) {
  console.error(`--origin deve essere solo schema://host[:porta], non ${origin}`);
  process.exit(2);
}

const base = profile();
const { app_name, description, ...rest } = base;
const exported = { app_name, description, target_origin: url.origin, ...rest };
const text = `${JSON.stringify(exported, null, 2)}\n`;

const out = arg('out');
if (typeof out === 'string') {
  writeFileSync(resolve(process.cwd(), out), text);
  console.log(`Profilo scritto in ${out} (target_origin ${url.origin})`);
} else {
  process.stdout.write(text);
}
