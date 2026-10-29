// Confronta i verdetti di una run LABBGEN con i bug seminati nella release che
// era online. Legge la memoria dall'API di LABBGEN (api/memory_api.py).
//
//   node scripts/score.mjs --trace <trace_id> --release r03
//   node scripts/score.mjs --trace <trace_id>                (release dal log di publish.mjs)
//   node scripts/score.mjs --trace <trace_id> --api http://127.0.0.1:8000
//
// Per ogni bug attivo dice se la suite generata tocca i suoi elementi (copertura),
// se un test fallito gli e' riconducibile (rilevamento) e con quale origine il
// triage lo ha classificato (attribuzione). Elenca poi i sut_bug che non
// corrispondono a nessun bug seminato (falsi positivi). Scrive runs/score-<trace>.json.
//
// Abbinamento verdetto -> bug, in ordine di affidabilita' (campo "basis"):
//   regola citata          la citazione del triage e' la frase del catalogo per quel bug
//   regola adiacente       cita la regola di un altro bug i cui test falliscono anche
//                          con questo acceso (collateral_tests): rilevato, non attribuito
//   test id nel ricevuto   un test id del bug compare in cio' che il test ha ricevuto:
//                          solo indicativo, mai "attribuito"
// Precisione dei sut_bug = quelli che citano la regola di un bug attivo / tutti.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { catalog, release, arg, path, quoteTokens, sentences, quotedSentences, parseMemoryTimestamp } from './lib.mjs';

const trace = arg('trace');
if (typeof trace !== 'string') {
  console.error('Uso: node scripts/score.mjs --trace <trace_id> [--release rNN] [--api URL]');
  process.exit(2);
}
const api = String(arg('api', process.env.LABBGEN_API ?? 'http://127.0.0.1:8000')).replace(/\/$/, '');

async function query(itemType) {
  const items = [];
  for (const store of ['task_history', 'working_memory']) {
    const url = `${api}/memory/items/query?store=${store}&item_type=${itemType}&trace_id=${encodeURIComponent(trace)}&limit=500`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    items.push(...(await res.json()));
  }
  return items;
}

function releaseFromLog(runStart) {
  const file = path('runs', 'releases.log.jsonl');
  if (!existsSync(file)) return null;
  const entries = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  // Anche le pubblicazioni via git: sono online solo dopo push e build, quindi
  // l'orario registrato e' un limite inferiore. Nel dubbio passa --release.
  const before = entries.filter((e) => new Date(e.published_at) <= runStart);
  return before.length ? before[before.length - 1].release : null;
}

const recommendations = await query('recommendation_record');
const runResults = await query('run_result_final');
const artifacts = await query('test_code_artifact');
const allItems = [...recommendations, ...runResults, ...artifacts];
if (!allItems.length) {
  console.error(`Nessun record per la trace ${trace} su ${api}.`);
  process.exit(1);
}
const createdAt = (item) => parseMemoryTimestamp(item.metadata.created_at).getTime();
const runStart = new Date(Math.min(...allItems.map(createdAt)));
const releaseId = typeof arg('release') === 'string' ? arg('release') : releaseFromLog(runStart);
if (!releaseId) {
  console.error('Release non indicata e non ricavabile da runs/releases.log.jsonl: passa --release rNN.');
  process.exit(2);
}
const manifest = release(releaseId);
const entries = catalog();
const byId = new Map(entries.map((e) => [e.id, e]));
const active = [...manifest.bugs, ...manifest.changes].map((id) => byId.get(id));
const activeBugs = active.filter((e) => e.kind === 'bug');

// Copertura sull'ultima versione della suite, non sulla somma delle versioni.
const latestArtifact = [...artifacts].sort((a, b) => createdAt(b) - createdAt(a))[0];
const code = String(latestArtifact?.payload.code ?? '');
const observed = runResults.flatMap((r) => r.payload.observed_tests ?? []);

const quoteOf = (p) => p.triage_evidence?.domain_rule_quote ?? '';
// I test id si cercano solo in cio' che il test ha davvero ricevuto, mai nel suo
// codice: quasi ogni test tocca summary-total o pay-button.
const receivedOf = (p) => [p.actual_behavior, p.locator_expected_text].filter(Boolean).join('\n');
const ruleHit = (e, quoted) => !!e.rule && sentences(e.rule).every((s) => quoted.has(s));

function matchVerdict(p) {
  const quoted = new Set(quotedSentences(quoteOf(p)));
  const byRule = activeBugs.filter((e) => ruleHit(e, quoted));
  if (byRule.length) return { basis: 'regola citata', bugs: byRule };
  // La citazione e' la regola di un altro bug del catalogo, e un test di quel bug
  // fallisce anche con questo acceso.
  const ruled = entries.filter((x) => x.kind === 'bug' && ruleHit(x, quoted));
  const adjacent = activeBugs.filter((a) => ruled.some((x) => x.oracle_tests.some((t) => a.collateral_tests?.includes(t))));
  if (adjacent.length) return { basis: 'regola adiacente', bugs: adjacent };
  const received = receivedOf(p);
  const bySignal = active.filter((e) => e.signals.some((s) => s.length >= 6 && received.includes(s)));
  return { basis: bySignal.length ? 'test id nel ricevuto' : null, bugs: bySignal };
}

const verdicts = recommendations
  .map((r) => r.payload)
  .filter((p) => p.failure_origin)
  .map((p) => ({ ...matchVerdict(p), p }));

const BASIS_RANK = { 'regola citata': 0, 'regola adiacente': 1, 'test id nel ricevuto': 2 };
const rank = (v) => BASIS_RANK[v.basis] * 2 + (v.p.failure_origin === 'sut_bug' ? 0 : 1);
const suspected = (p) => p.suspected_sut_bug || (p.failure_origin === 'user_story_issue' && p.requires_human_confirmation);

const perBug = active.map((e) => {
  const covered = e.signals.some((s) => s.length >= 6 && code.includes(s));
  const matches = verdicts.filter((v) => v.bugs.includes(e)).sort((a, b) => rank(a) - rank(b));
  const best = matches[0];
  const origin = best?.p.failure_origin;
  let outcome;
  if (e.kind === 'change') {
    outcome = matches.some((v) => v.p.failure_origin === 'sut_bug')
      ? 'falso positivo su modifica legittima'
      : matches.length ? `adattamento richiesto, classificato ${origin}` : 'nessun fallimento riconducibile';
  } else if (e.kind === 'timing') {
    outcome = best ? `classificato ${origin}` : 'nessun fallimento riconducibile';
  } else if (!best) {
    outcome = covered ? 'non rilevato (elementi toccati dalla suite)' : 'non rilevato (fuori copertura)';
  } else if (best.basis === 'regola citata') {
    outcome = origin === 'sut_bug' ? 'attribuito' : suspected(best.p) ? 'sospetto, in coda per una persona' : `rilevato ma classificato ${origin}`;
  } else if (best.basis === 'regola adiacente') {
    outcome = `rilevato su una regola adiacente, classificato ${origin}`;
  } else {
    outcome = `rilevato (abbinamento indicativo), classificato ${origin}`;
  }
  return {
    id: e.id, kind: e.kind, level: e.level, title: e.title, covered,
    detected: !!best && e.kind === 'bug', origin: origin ?? null, basis: best?.basis ?? null,
    test: best?.p.test_name ?? null, outcome,
  };
});

const sutBugVerdicts = verdicts.filter((v) => v.p.failure_origin === 'sut_bug');
const attributedSutBugs = sutBugVerdicts.filter((v) => v.basis === 'regola citata');
const adjacentSutBugs = sutBugVerdicts.filter((v) => v.basis === 'regola adiacente');
// Un sut_bug che non cita la regola di un bug attivo (ne' una adiacente) e' un
// falso positivo, anche se nel ricevuto compare un test id di un bug attivo.
const falsePositives = sutBugVerdicts
  .filter((v) => v.basis !== 'regola citata' && v.basis !== 'regola adiacente')
  .map((v) => ({ test: v.p.test_name, quote: quoteOf(v.p), summary: v.p.summary, hint: v.bugs.map((e) => e.id) }));
const bugs = perBug.filter((b) => b.kind === 'bug');
const ratio = (n, d) => (d ? Math.round((n / d) * 100) / 100 : null);
const metrics = {
  bugs_active: bugs.length,
  bugs_covered: bugs.filter((b) => b.covered).length,
  bugs_detected: bugs.filter((b) => b.detected).length,
  bugs_attributed: bugs.filter((b) => b.outcome === 'attribuito').length,
  bugs_suspected: bugs.filter((b) => b.outcome.startsWith('sospetto')).length,
  detection_recall: ratio(bugs.filter((b) => b.detected).length, bugs.length),
  attribution_recall: ratio(bugs.filter((b) => b.outcome === 'attribuito').length, bugs.length),
  sut_bug_precision: ratio(attributedSutBugs.length, sutBugVerdicts.length),
  sut_bug_verdicts: sutBugVerdicts.length,
  sut_bug_on_adjacent_rule: adjacentSutBugs.length,
  false_positives: falsePositives.length,
  tests_observed: observed.length,
  verdicts_total: verdicts.length,
};

const result = { trace, release: releaseId, api, run_started_at: runStart.toISOString(), metrics, per_bug: perBug, false_positives: falsePositives };
mkdirSync(path('runs'), { recursive: true });
writeFileSync(path('runs', `score-${trace}.json`), `${JSON.stringify(result, null, 2)}\n`);

console.log(`Run ${trace} contro ${releaseId} (${manifest.bugs.join(', ') || 'nessun bug'}${manifest.changes.length ? `; modifiche ${manifest.changes.join(', ')}` : ''})`);
for (const b of perBug) console.log(`  ${b.id} ${b.level} ${b.covered ? 'coperto ' : 'scoperto'}  ${b.outcome}${b.basis ? ` [${b.basis}]` : ''}`);
console.log(`Rilevati ${metrics.bugs_detected}/${metrics.bugs_active}, attribuiti ${metrics.bugs_attributed}/${metrics.bugs_active}, sospetti ${metrics.bugs_suspected}; sut_bug ${metrics.sut_bug_verdicts}, su regola adiacente ${metrics.sut_bug_on_adjacent_rule}, falsi positivi ${metrics.false_positives}.`);
for (const fp of falsePositives) console.log(`  falso positivo: ${fp.test} :: ${quoteTokens(fp.quote).slice(0, 120)}`);
console.log(`Dettaglio in runs/score-${trace}.json`);
