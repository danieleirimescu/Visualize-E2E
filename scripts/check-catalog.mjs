// Verifica statica di catalogo, release e profilo. Esce con 1 al primo problema
// trovato (dopo averli elencati tutti).
import { readFileSync, readdirSync } from 'node:fs';
import { catalog, profile, releases, profileSentences, quoteIsWholeSentences, testTitles, path } from './lib.mjs';

const problems = [];
const entries = catalog();
const ids = entries.map((e) => e.id);
const byId = new Map(entries.map((e) => [e.id, e]));

// 1. Id unici e dichiarati in src/env.d.ts.
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) problems.push(`id duplicati nel catalogo: ${dup.join(', ')}`);
const declared = [...readFileSync(path('src/env.d.ts'), 'utf8').matchAll(/__BUG_(\w+)__/g)].map((m) => m[1]);
for (const id of ids) if (!declared.includes(id)) problems.push(`${id}: manca 'declare const __BUG_${id}__' in src/env.d.ts`);
for (const id of declared) if (!ids.includes(id)) problems.push(`src/env.d.ts dichiara __BUG_${id}__, che non e' nel catalogo`);

// 2. Ogni costante e' usata nel codice (una voce mai letta non muta niente).
const sources = readdirSync(path('src'), { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
  .map((f) => readFileSync(path('src', f), 'utf8'))
  .join('\n');
for (const id of ids) if (!sources.includes(`__BUG_${id}__`)) problems.push(`${id}: la costante non e' usata in nessun file di src/`);

// 3. Regola citabile, test di riferimento esistenti, incompatibilita' note.
const sentenceSet = profileSentences();
const titles = testTitles();
for (const e of entries) {
  if (e.kind === 'bug') {
    if (!e.rule) problems.push(`${e.id}: un bug deve citare una regola`);
    else if (!quoteIsWholeSentences(e.rule, sentenceSet)) problems.push(`${e.id}: la regola non e' una frase intera del profilo: "${e.rule}"`);
    if (!e.oracle_tests?.length) problems.push(`${e.id}: nessun test di riferimento`);
  }
  for (const t of [...(e.oracle_tests ?? []), ...(e.collateral_tests ?? [])]) if (!titles.has(t)) problems.push(`${e.id}: test di riferimento inesistente "${t}"`);
  for (const other of e.incompatible_with ?? []) if (!byId.has(other)) problems.push(`${e.id}: incompatibile con un id sconosciuto ${other}`);
  if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(e.level)) problems.push(`${e.id}: livello non valido ${e.level}`);
}

// 4. Release: id noti, nessuna coppia incompatibile, coerenza di fixed/reintroduced.
const all = releases();
const seenBugs = new Set();
for (const r of all) {
  const active = [...(r.bugs ?? []), ...(r.changes ?? [])];
  for (const id of active) if (!byId.has(id)) problems.push(`${r.id}: id sconosciuto ${id}`);
  for (const id of r.bugs ?? []) if (byId.get(id)?.kind === 'change') problems.push(`${r.id}: ${id} e' un change, va in "changes"`);
  for (const id of r.changes ?? []) if (byId.get(id)?.kind !== 'change') problems.push(`${r.id}: ${id} non e' un change`);
  for (const a of active) for (const b of active) {
    if (a < b && (byId.get(a)?.incompatible_with?.includes(b) || byId.get(b)?.incompatible_with?.includes(a))) problems.push(`${r.id}: ${a} e ${b} sono incompatibili`);
  }
  const base = r.based_on ? all.find((x) => x.id === r.based_on) : null;
  if (r.based_on && !base) problems.push(`${r.id}: based_on ${r.based_on} inesistente`);
  for (const id of r.fixed ?? []) if (base && !base.bugs.includes(id)) problems.push(`${r.id}: dichiara corretto ${id}, che non c'era in ${base.id}`);
  for (const id of r.fixed ?? []) if (r.bugs.includes(id)) problems.push(`${r.id}: ${id} e' sia corretto sia attivo`);
  for (const id of r.reintroduced ?? []) if (!seenBugs.has(id)) problems.push(`${r.id}: reintroduce ${id}, mai comparso prima`);
  (r.bugs ?? []).forEach((id) => seenBugs.add(id));
}

// 5. Profilo entro i limiti che la pipeline applica (graph/domain_context.py,
//    graph/scout_exploration.py).
const p = profile();
if ((p.business_rules ?? []).length > 40) problems.push(`profilo: ${p.business_rules.length} regole, la pipeline ne mostra 40`);
for (const rule of p.business_rules ?? []) {
  if (rule.length > 400) problems.push(`profilo: regola di ${rule.length} caratteri (limite 400): ${rule.slice(0, 60)}...`);
}
if ((p.description ?? '').length > 400) problems.push(`profilo: description di ${p.description.length} caratteri (limite 400)`);
let totalSteps = 0;
p.workflows.forEach((w, i) => {
  if ((w.expected_behavior ?? '').length > 1500) problems.push(`${w.id}: expected_behavior di ${w.expected_behavior.length} caratteri (limite 1500)`);
  const steps = w.steps?.length ?? 0;
  totalSteps += steps;
  if (steps > 20) problems.push(`${w.id}: ${steps} passi (limite 20)`);
  if (w.continues_from && p.workflows[i - 1]?.id !== w.continues_from) problems.push(`${w.id}: continues_from deve nominare il workflow immediatamente precedente`);
});
if (totalSteps > 60) problems.push(`profilo: ${totalSteps} passi in tutto (limite 60)`);
for (const e of entries) if (e.workflow && !p.workflows.some((w) => w.id === e.workflow)) problems.push(`${e.id}: workflow ${e.workflow} non nel profilo`);

if (problems.length) {
  console.error(`Trovati ${problems.length} problemi:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: ${entries.length} voci, ${all.length} release, ${p.workflows.length} workflow (${totalSteps} passi), ${p.business_rules.length} regole.`);
