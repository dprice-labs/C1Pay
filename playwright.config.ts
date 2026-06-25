import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // In CI, serve a production build. `next dev` compiles routes on demand and
    // serves requests near-sequentially, which caused navigation timeouts under
    // parallel load and previously forced an artificial worker cap. `next start`
    // handles concurrency properly, so the full worker pool is safe.
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // `next build` needs headroom on a cold CI container before the server is up.
    timeout: process.env.CI ? 180_000 : undefined,
  },
})
