import { defineConfig, devices } from '@playwright/test';

// Suite di riferimento: gira contro la build in dist/ servita da vite preview.
// scripts/oracle.mjs e scripts/mutants.mjs fanno la build prima di lanciarla.
const PORT = Number(process.env.ORACLE_PORT ?? 4174);
const DIST = process.env.ORACLE_DIST ?? 'dist';

export default defineConfig({
  testDir: 'oracle-tests',
  fullyParallel: true,
  workers: process.env.ORACLE_WORKERS ? Number(process.env.ORACLE_WORKERS) : undefined,
  retries: 0,
  reporter: process.env.ORACLE_REPORTER ?? 'list',
  timeout: 20_000,
  expect: { timeout: 3_000 },
  use: {
    baseURL: process.env.ORACLE_BASE_URL ?? `http://localhost:${PORT}`,
    trace: 'off',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.ORACLE_BASE_URL
    ? undefined
    : {
        command: `npx vite preview --port ${PORT} --strictPort --outDir ${DIST}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 30_000,
      },
});
