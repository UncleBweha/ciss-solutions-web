import { defineConfig, devices } from '@playwright/test'

// E2E tests run against a dev or production server backed by local Supabase
// (`npx supabase start`) with MPESA_ENV=mock. See README "Testing".
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: baseURL, reuseExistingServer: true, timeout: 120_000 },
})
