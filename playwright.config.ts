import { defineConfig, devices } from '@playwright/test';

const PORT = 4322;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    colorScheme: 'dark',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
  ],
  // Serves the production build in dist/ (run `pnpm build` first; `pnpm test:e2e` does).
  webServer: {
    command: `pnpm exec astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
