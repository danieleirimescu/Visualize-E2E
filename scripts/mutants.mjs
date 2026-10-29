// Controllo dei mutanti: per ogni bug del catalogo costruisce il sito con quel
// solo bug acceso e verifica che i suoi test di riferimento falliscano, e che
// falliscano su un'asserzione (atteso contro ricevuto) e non per timeout: un bug
// che si vede solo come timeout il triage lo legge come ambiente o selettore.
//
//   node scripts/mutants.mjs               solo i test di riferimento di ogni bug
//   node scripts/mutants.mjs --full        tutta la suite per ogni voce (anche timing/change)
//   node scripts/mutants.mjs --only B07,B19
//   node scripts/mutants.mjs --full --write-collateral   aggiorna collateral_tests nel catalogo
//
// Scrive il risultato in .mutants/report.json ed esce con 1 se un bug non e' colto.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { catalog, arg, escapeRegex, path, ROOT, VITE, PLAYWRIGHT } from './lib.mjs';

const full = arg('full', false) === true;
const only = typeof arg('only') === 'string' ? arg('only').split(',') : null;
const entries = catalog().filter((e) => (only ? only.includes(e.id) : full || e.kind === 'bug'));

const run = (cmd, args, env) =>
  spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });

// Come la legge la pipeline: un'asserzione con un ricevuto e' la sola forma che il
// triage puo' attribuire a un difetto. "element(s) not found" (anche dentro un
// expect) e un timeout il Reflector li legge come selettore o ambiente.
function failureKind(status, message) {
  const received = /Received(?: string| value| array| object| number)?: (?!<element\(s\) not found>)/.test(message);
  if (/element\(s\) not found|locator resolved to 0 elements/i.test(message) && !received) return 'not_found';
  if (status === 'timedOut' || /Test timeout of \d+ms exceeded/.test(message)) return 'timeout';
  if (/Timeout \d+ms exceeded/.test(message) && !received) return 'timeout';
  // toEqual/toBe su valori: "expect(received).toEqual(expected)" con un diff
  // "- Expected / + Received".
  if (received || /expect\(.*\)\..* failed/.test(message) || /expect\(received\)\.\w+\(/.test(message) || /^\+ Received/m.test(message)) return 'assertion';
  return 'other';
}

function failuresFrom(reportFile) {
  if (!existsSync(reportFile)) return [];
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        if (!last || last.status === 'passed' || last.status === 'skipped') continue;
        const message = (last.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '');
        out.push({ title: spec.title, status: last.status, kind: failureKind(last.status, message), message: message.split('\n').slice(0, 8).join('\n') });
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  (report.suites ?? []).forEach(walk);
  return out;
}

mkdirSync(path('.mutants'), { recursive: true });
const results = [];
for (const e of entries) {
  const outDir = `.mutants/${e.id}`;
  const build = run(process.execPath, [VITE, 'build', '--outDir', outDir, '--emptyOutDir'], { BUGS: e.id });
  if (build.status !== 0) {
    results.push({ id: e.id, ok: false, reason: 'build fallita', detail: build.stderr.slice(-800) });
    console.log(`${e.id}  BUILD FALLITA`);
    continue;
  }
  const reportFile = path('.mutants', `${e.id}.json`);
  rmSync(reportFile, { force: true });
  const args = [PLAYWRIGHT, 'test', '--reporter=json'];
  if (!full && e.oracle_tests.length) args.push('-g', e.oracle_tests.map(escapeRegex).join('|'));
  const test = run(process.execPath, args, { ORACLE_DIST: outDir, PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile });
  const failures = failuresFrom(reportFile);
  const failedTitles = new Set(failures.map((f) => f.title));
  const missed = e.oracle_tests.filter((t) => !failedTitles.has(t));
  const notAssertion = failures.filter((f) => e.oracle_tests.includes(f.title) && f.kind !== 'assertion');
  const collateral = failures.filter((f) => !e.oracle_tests.includes(f.title)).map((f) => f.title);
  let ok;
  let reason;
  if (e.kind === 'bug') {
    ok = missed.length === 0 && notAssertion.length === 0;
    reason = missed.length
      ? `non colto da: ${missed.join('; ')}`
      : notAssertion.length
        ? `colto ma non su un'asserzione: ${notAssertion.map((f) => `${f.title} (${f.kind})`).join('; ')}`
        : 'colto su asserzione';
    if (full && collateral.length) reason += `; collaterali: ${collateral.join('; ')}`;
  } else {
    ok = true;
    reason = `${failures.length} test falliti (${e.kind}, atteso: ${e.expected_triage})`;
  }
  if (test.status !== 0 && !failures.length) {
    ok = false;
    reason = `il runner e' uscito con ${test.status} senza report leggibile`;
  }
  results.push({ id: e.id, level: e.level, kind: e.kind, ok, reason, collateral, failures });
  console.log(`${e.id}  ${e.level}  ${ok ? 'OK ' : 'KO '}  ${reason}`);
}

if (full && arg('write-collateral', false) === true) {
  const file = path('bugs', 'catalog.json');
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  for (const r of results) {
    const entry = doc.entries.find((x) => x.id === r.id);
    if (entry && r.collateral) entry.collateral_tests = r.collateral;
  }
  writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  console.log('collateral_tests aggiornati in bugs/catalog.json');
}

writeFileSync(path('.mutants', 'report.json'), JSON.stringify({ generated_at: new Date().toISOString(), full, results }, null, 2));
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} voci verificate. Dettagli in .mutants/report.json`);
process.exit(bad.length ? 1 : 0);
