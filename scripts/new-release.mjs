// Genera il manifest della release successiva, riproducibile da un seed.
//
//   node scripts/new-release.mjs --seed 7
//   node scripts/new-release.mjs --seed 7 --count 3 --keep 1 --reintroduce --base r06
//   node scripts/new-release.mjs --seed 7 --timing --dry-run
//
// --count N      bug nuovi da introdurre (default 3)
// --keep K       bug della release di base che restano (default 1); gli altri risultano corretti
// --reintroduce  aggiunge un bug gia' corretto in passato (regressione)
// --timing       ammette anche la voce di timing T01
// --levels L1,L4 limita i bug nuovi a questi livelli
// --base rNN     release di partenza (default l'ultima); i change si ereditano sempre
//
// Regole di scelta: niente coppie incompatibili, al massimo un bug per pagina,
// livelli diversi finche' possibile.
import { writeFileSync } from 'node:fs';
import { catalog, releases, arg, path } from './lib.mjs';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rawSeed = arg('seed', String(Date.now() % 100000));
if (rawSeed === true || !Number.isInteger(Number(rawSeed))) {
  console.error('--seed vuole un intero, es. --seed 7');
  process.exit(2);
}
const seed = Number(rawSeed);
const count = Number(arg('count', 3));
const keep = Number(arg('keep', 1));
const reintroduce = arg('reintroduce', false) === true;
const timing = arg('timing', false) === true;
const levels = typeof arg('levels') === 'string' ? arg('levels').split(',') : null;
const dryRun = arg('dry-run', false) === true;

const all = releases();
const base = typeof arg('base') === 'string' ? all.find((r) => r.id === arg('base')) : all[all.length - 1];
if (!base) throw new Error('Release di base non trovata');
const nextNumber = Math.max(...all.map((r) => Number(r.id.slice(1)))) + 1;
const id = `r${String(nextNumber).padStart(2, '0')}`;

const random = mulberry32(seed);
const shuffle = (list) => list.map((x) => [random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const entries = catalog();
const byId = new Map(entries.map((e) => [e.id, e]));
const compatible = (chosen, candidate) =>
  chosen.every((c) => !byId.get(c).incompatible_with.includes(candidate.id) && !candidate.incompatible_with.includes(c));

const chosen = [];
const pages = new Set();
const take = (e) => {
  chosen.push(e.id);
  pages.add(e.page);
};

for (const bugId of shuffle(base.bugs).slice(0, Math.max(0, keep))) take(byId.get(bugId));
const kept = [...chosen];

// Un bug gia' comparso in una release precedente non e' mai "nuovo": se torna,
// e' una regressione e va dichiarato come tale (--reintroduce).
const past = new Set(all.flatMap((r) => r.bugs));
let reintroduced = [];
if (reintroduce) {
  const pool = shuffle([...past].filter((b) => !base.bugs.includes(b)).map((b) => byId.get(b)))
    .filter((e) => compatible(chosen, e) && !pages.has(e.page));
  if (pool.length) {
    take(pool[0]);
    reintroduced = [pool[0].id];
  } else {
    console.warn('Nessun bug gia corretto e compatibile da reintrodurre.');
  }
}

const pool = shuffle(entries.filter((e) => (e.kind === 'bug' || (timing && e.kind === 'timing')) && !past.has(e.id) && !chosen.includes(e.id) &&(!levels || levels.includes(e.level))));
const usedLevels = new Set(chosen.map((c) => byId.get(c).level));
let added = 0;
while (added < count) {
  const candidates = pool.filter((e) => !chosen.includes(e.id) && compatible(chosen, e) && !pages.has(e.page));
  if (!candidates.length) {
    console.warn(`Solo ${added} bug nuovi compatibili trovati su ${count} richiesti.`);
    break;
  }
  const fresh = candidates.find((e) => !usedLevels.has(e.level)) ?? candidates[0];
  take(fresh);
  usedLevels.add(fresh.level);
  added++;
}

const manifest = {
  id,
  based_on: base.id,
  seed,
  bugs: chosen,
  changes: base.changes ?? [],
  fixed: base.bugs.filter((b) => !chosen.includes(b)),
  reintroduced,
  notes: `Generata con seed ${seed}: ${kept.length} bug mantenuti da ${base.id}, ${reintroduced.length} reintrodotti, ${added} nuovi.`,
};

const text = `${JSON.stringify(manifest, null, 2)}\n`;
if (dryRun) {
  process.stdout.write(text);
} else {
  writeFileSync(path('releases', `${id}.json`), text);
  console.log(`Scritta releases/${id}.json`);
  for (const b of chosen) console.log(`  ${b}  ${byId.get(b).level}  ${byId.get(b).page.padEnd(14)} ${byId.get(b).title}`);
  console.log('Verifica con: npm run check:catalog && node scripts/oracle.mjs --release ' + id);
}
