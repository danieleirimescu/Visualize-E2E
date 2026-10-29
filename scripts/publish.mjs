// Pubblica una release sull'URL stabile del sito.
//
//   node scripts/publish.mjs r03            build locale + netlify deploy --prod
//   node scripts/publish.mjs r03 --git      aggiorna solo CURRENT_RELEASE: committalo e fai push,
//                                          Netlify costruisce dal repo
//   node scripts/publish.mjs r03 --dry-run  solo build, nessun deploy
//
// L'URL resta lo stesso fra le release: per la memoria di LABBGEN il SUT e'
// TARGET_APP_URL, e un URL per release frammenterebbe la Task History.
// Ogni pubblicazione aggiunge una riga a runs/releases.log.jsonl, che
// scripts/score.mjs usa per sapere quale release era online durante una run.
// Il manifest non finisce mai nel sito pubblicato.
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { release, arg, path, ROOT, VITE } from './lib.mjs';

const id = process.argv[2];
if (!id || id.startsWith('--')) {
  console.error('Uso: node scripts/publish.mjs <rNN> [--git | --dry-run]');
  process.exit(2);
}
const manifest = release(id);
const gitMode = arg('git', false) === true;
const dryRun = arg('dry-run', false) === true;

const env = { ...process.env, RELEASE: id };
delete env.BUGS;

// CURRENT_RELEASE cambia solo quando la release va davvero online (o, in modalita'
// git, quando e' pronta per il push): una build fallita o un dry run non lo toccano.
// Dopo un deploy da CLI va committato, altrimenti il push successivo ripubblica la
// release che c'era prima.
const markCurrent = () => writeFileSync(path('CURRENT_RELEASE'), `${id}\n`);
mkdirSync(path('runs'), { recursive: true });
const log = (entry) => appendFileSync(path('runs', 'releases.log.jsonl'), `${JSON.stringify({ release: id, bugs: manifest.bugs, changes: manifest.changes, published_at: new Date().toISOString(), ...entry })}\n`);

if (gitMode) {
  markCurrent();
  log({ mode: 'git', note: 'online solo dopo commit, push e build di Netlify' });
  console.log(`CURRENT_RELEASE = ${id}. Ora: git commit -am "release ${id}" && git push (Netlify costruisce dal repo).`);
  process.exit(0);
}

const build = spawnSync(process.execPath, [VITE, 'build'], { cwd: ROOT, stdio: 'inherit', env });
if (build.status !== 0) process.exit(build.status ?? 1);
if (dryRun) {
  console.log(`Build di ${id} in dist/ (dry run, nessun deploy).`);
  process.exit(0);
}

const deploy = spawnSync('netlify', ['deploy', '--prod', '--dir=dist', `--message=release-${id}`, '--json'], {
  cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', env,
});
if (deploy.error || deploy.status !== 0) {
  console.error(deploy.stderr || deploy.error?.message || 'netlify deploy fallito');
  console.error('Serve la CLI di Netlify collegata al sito: npm i -g netlify-cli, poi netlify login e netlify link.');
  process.exit(deploy.status ?? 1);
}
let info = {};
try {
  info = JSON.parse(deploy.stdout);
} catch {
  /* output non JSON: si registra comunque la pubblicazione */
}
markCurrent();
log({ mode: 'cli', deploy_id: info.deploy_id, url: info.url, deploy_url: info.deploy_url });
console.log(`Release ${id} online su ${info.url ?? 'URL di produzione'} (permalink ${info.deploy_url ?? 'n/d'}). Committa CURRENT_RELEASE.`);
