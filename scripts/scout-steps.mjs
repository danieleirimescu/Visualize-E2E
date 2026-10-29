// Esegue i passi `steps` dei workflow del profilo su ogni release, con la stessa
// semantica dello Scout di LABBGEN (graph/scout_exploration.py e
// site_context_discovery_node.py): un browser nuovo per workflow, la stessa
// sessione solo con continues_from se il precedente e' arrivato in fondo, 5 secondi
// per passo, il primo passo che fallisce ferma il resto del workflow.
// Serve a non scoprire durante una run che una release (es. con C01) rompe
// l'esplorazione e quindi il catalogo su cui il Translator fonda i selettori.
//
//   node scripts/scout-steps.mjs                 tutte le release
//   node scripts/scout-steps.mjs --release r05
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { releases, release, profile, arg, ROOT, VITE } from './lib.mjs';

const PORT = 4182;
const STEP_TIMEOUT = 5000;
const URL_TIMEOUT = 10000;
const only = typeof arg('release') === 'string' ? [release(arg('release'))] : releases();
const workflows = profile().workflows;

async function runStep(page, step) {
  const t = { timeout: STEP_TIMEOUT };
  switch (step.action) {
    case 'click': return page.click(step.selector, { ...t, force: step.force });
    case 'dblclick': return page.dblclick(step.selector, { ...t, force: step.force });
    case 'check': return page.check(step.selector, { ...t, force: step.force });
    case 'hover': return page.hover(step.selector, t);
    case 'fill': return page.fill(step.selector, step.text, t);
    case 'press': return page.press(step.selector, step.key, t);
    case 'select': return page.selectOption(step.selector, step.value !== undefined ? { value: step.value } : { label: step.label }, t);
    case 'wait_for':
      return step.selector ? page.waitForSelector(step.selector, { state: 'visible', ...t }) : page.waitForTimeout(Math.min(step.timeout_ms ?? 0, 10000));
    case 'goto': return page.goto(new URL(step.url, `http://localhost:${PORT}`).href);
    case 'wait_for_url': return page.waitForURL((u) => u.href.includes(step.url_contains), { timeout: step.timeout_ms ?? URL_TIMEOUT });
    default: throw new Error(`azione sconosciuta ${step.action}`);
  }
}

async function checkRelease(r) {
  const outDir = `.mutants/steps-${r.id}`;
  const env = { ...process.env, RELEASE: r.id };
  delete env.BUGS;
  const build = spawnSync(process.execPath, [VITE, 'build', '--outDir', outDir, '--emptyOutDir'], { cwd: ROOT, env, encoding: 'utf8' });
  if (build.status !== 0) return [{ workflow: '*', ok: false, detail: 'build fallita' }];
  const server = spawn(process.execPath, [VITE, 'preview', '--port', String(PORT), '--strictPort', '--outDir', outDir], { cwd: ROOT, env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
      } catch {
        /* non ancora pronto */
      }
      await new Promise((res) => setTimeout(res, 200));
    }
    const browser = await chromium.launch();
    const results = [];
    let context;
    let page;
    let previousOk = false;
    for (const w of workflows) {
      if (w.continues_from) {
        if (!previousOk) {
          results.push({ workflow: w.id, ok: false, detail: `non eseguito: ${w.continues_from} non e' arrivato in fondo` });
          previousOk = false;
          continue;
        }
      } else {
        await context?.close();
        context = await browser.newContext({ locale: 'it-IT', timezoneId: 'Europe/Rome' });
        page = await context.newPage();
        await page.goto(`http://localhost:${PORT}/`);
      }
      let failed = null;
      for (const [index, step] of (w.steps ?? []).entries()) {
        try {
          await runStep(page, step);
        } catch (error) {
          failed = `passo ${index + 1} (${step.action} ${step.selector ?? step.url ?? step.url_contains ?? ''}): ${String(error.message).split('\n')[0]}`;
          break;
        }
      }
      previousOk = !failed;
      results.push({ workflow: w.id, ok: !failed, detail: failed ?? `${w.steps?.length ?? 0} passi` });
    }
    await browser.close();
    return results;
  } finally {
    server.kill();
  }
}

let bad = 0;
for (const r of only) {
  const results = await checkRelease(r);
  const failing = results.filter((x) => !x.ok);
  bad += failing.length;
  console.log(`${r.id}  ${failing.length ? 'KO' : 'OK'}  ${results.length - failing.length}/${results.length} workflow completi`);
  for (const f of failing) console.log(`    ${f.workflow}: ${f.detail}`);
}
// Con T01 (mappa lenta) un workflow che si ferma e' il comportamento atteso.
process.exit(bad ? 1 : 0);
