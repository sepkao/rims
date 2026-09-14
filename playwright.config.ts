import { defineConfig } from '@playwright/test'

const DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const SESSION_SECRET = 'e2e-only-session-secret-1234567890'
const API_URL = 'http://localhost:3000'
const CUSTOMER_URL = 'http://localhost:5173'
const INTERNAL_URL = 'http://localhost:5174'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev --workspace api',
      port: 3000,
      env: { DATABASE_URL, SESSION_SECRET, PORT: '3000' },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev --workspace customer',
      port: 5173,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev --workspace internal',
      port: 5174,
      env: { VITE_API_URL: API_URL, VITE_CUSTOMER_APP_URL: CUSTOMER_URL },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
