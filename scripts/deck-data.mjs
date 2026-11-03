// Dati delle run della pipeline LABBGEN su Visualize, per la presentazione
// (runs/presentazione). Legge la memoria direttamente da MongoDB (container
// labbgen-mongodb), quindi non serve l'API.
//
//   node scripts/deck-data.mjs                 tutte le run concluse, dalla piu' vecchia
//   node scripts/deck-data.mjs --new           solo quelle non ancora nella presentazione
//   node scripts/deck-data.mjs --trace <id>    una run, con i verdetti del triage
//   node scripts/deck-data.mjs --mark <id>     segna la run come gia' nella presentazione
//
// Una run e' "conclusa" quando ha scritto il planner_summary. La release di una run
// e' l'ultima pubblicata (runs/releases.log.jsonl) prima del suo inizio, r00 se nessuna.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { arg, path } from './lib.mjs';

const SITE = /visualizecinema/;
const STATE = path('runs', 'presentazione', 'state.json');

function mongo(code) {
  const r = spawnSync('docker', ['exec', 'labbgen-mongodb', 'mongosh', 'labbgen', '--quiet', '--eval', code], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`mongosh non risponde (${r.status}): ${(r.stderr || r.stdout).slice(0, 400)}`);
    process.exit(3);
  }
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

const state = () => (existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { processed: [] });

function releaseAt(iso) {
  const file = path('runs', 'releases.log.jsonl');
  if (!existsSync(file)) return 'r00';
  const start = new Date(iso).getTime();
  const published = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((e) => new Date(e.published_at).getTime() <= start)
    .sort((a, b) => new Date(a.published_at) - new Date(b.published_at));
  return published.length ? published[published.length - 1].release : 'r00';
}

function runs() {
  const list = mongo(`
    const traces = db.memory_items.distinct('trace_id', {item_type:'test_code_artifact','payload_json.target_app_url':${SITE}});
    const out = [];
    for (const t of traces) {
      const s = db.memory_items.findOne({trace_id:t,item_type:'planner_summary'});
      if (!s) continue;
      const m = s.payload_json.metrics || {};
      const rr = db.memory_items.findOne({trace_id:t,item_type:'run_result_final'});
      const obs = (rr && rr.payload_json.observed_tests) || [];
      const count = (st) => obs.filter(o => o.status === st).length;
      const verdicts = db.memory_items.find({trace_id:t,item_type:'recommendation_record'}).toArray().map(d => d.payload_json.failure_origin);
      const by = {}; verdicts.forEach(v => by[v] = (by[v]||0)+1);
      const a = db.memory_items.findOne({trace_id:t,item_type:'test_code_artifact'}).payload_json;
      out.push({ trace: t, finished_at: s.created_at, duration_seconds: m.pipeline_duration_seconds ?? null,
        cost_usd: m.llm_cost_total ?? null, tests: obs.length, passed: count('passed'), failed: count('failed'),
        flaky: count('flaky'), skipped: count('skipped'), verdicts: by,
        human_decisions_applied: (a.applied_human_decision_ids || []).length,
        node_seconds: Object.fromEntries(Object.entries(m.node_timings || {}).map(([k, v]) => [k, Math.round((v && (v.seconds ?? v.total_seconds ?? v)) || 0)])) });
    }
    print(JSON.stringify(out));`);
  return list
    .map((r) => {
      const started = r.duration_seconds ? new Date(new Date(r.finished_at).getTime() - r.duration_seconds * 1000).toISOString() : r.finished_at;
      return { ...r, started_at: started, release: releaseAt(started) };
    })
    .sort((a, b) => new Date(a.finished_at) - new Date(b.finished_at))
    .map((r, i, all) => ({ ...r, run_in_release: all.filter((x, j) => j <= i && x.release === r.release).length }));
}

function verdicts(trace) {
  return mongo(`
    print(JSON.stringify(db.memory_items.find({trace_id:'${trace}',item_type:'recommendation_record'}).toArray().map(d => { const p = d.payload_json; return {
      test: p.test_name, origin: p.failure_origin, human: p.requires_human_confirmation, source: p.triage_source,
      expected: p.expected_behavior, actual: String(p.actual_behavior || '').slice(0, 400),
      rule: (p.triage_evidence || {}).domain_rule_quote || null }; })));`);
}

if (typeof arg('mark') === 'string') {
  const s = state();
  if (!s.processed.includes(arg('mark'))) s.processed.push(arg('mark'));
  writeFileSync(STATE, `${JSON.stringify(s, null, 2)}\n`);
  console.log(`segnata ${arg('mark')} (${s.processed.length} run nella presentazione)`);
} else if (typeof arg('trace') === 'string') {
  const run = runs().find((r) => r.trace === arg('trace'));
  console.log(JSON.stringify({ ...run, failures: verdicts(arg('trace')) }, null, 2));
} else {
  const all = runs();
  const done = new Set(state().processed);
  const out = arg('new', false) === true ? all.filter((r) => !done.has(r.trace)) : all;
  console.log(JSON.stringify(out, null, 2));
}
