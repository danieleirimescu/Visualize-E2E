// Costruisce una release (default r00) e le fa girare contro la suite di riferimento.
//   node scripts/oracle.mjs            -> r00 deve passare tutta
//   node scripts/oracle.mjs --release r03
import { spawnSync } from 'node:child_process';
import { arg, ROOT, VITE, PLAYWRIGHT } from './lib.mjs';

const releaseId = arg('release', 'r00');
const baseEnv = { ...process.env };
delete baseEnv.BUGS; // un elenco esplicito vincerebbe sul manifest della release
const run = (cmd, args, env = {}) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...baseEnv, ...env } });

const built = run(process.execPath, [VITE, 'build', '--outDir', '.mutants/oracle', '--emptyOutDir'], { RELEASE: releaseId });
if (built.status !== 0) process.exit(built.status ?? 1);
const tested = run(process.execPath, [PLAYWRIGHT, 'test'], { ORACLE_DIST: '.mutants/oracle' });
process.exit(tested.status ?? 1);
