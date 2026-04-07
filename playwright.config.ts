import { defineConfig, devices } from "@playwright/test";

const TEST_DB_URL = "postgresql://test:test@localhost:5433/its_karte_test";
const TEST_PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: "html",
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: `pnpm dev --port ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL: TEST_DB_URL },
    timeout: 60_000,
  },
});
