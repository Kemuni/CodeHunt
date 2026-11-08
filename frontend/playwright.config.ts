import { defineConfig } from "@playwright/test"
import { tmpdir } from "node:os"
import { join } from "node:path"

const isolated = process.env.E2E_ISOLATED_AUTH === "1"
if (isolated) {
  process.env.E2E_AUTH_SECRET = "isolated-e2e-secret-never-use-in-production"
  process.env.E2E_BASE_URL = "http://localhost:3100"
  process.env.E2E_LIVE_API = "0"
}

export default defineConfig({
  webServer: isolated
    ? [
        {
          command: "node e2e/auth-backend.mjs",
          url: "http://127.0.0.1:8101/health",
          reuseExistingServer: false,
        },
        {
          command: "npm run dev -- --port 3100",
          url: "http://localhost:3100/login",
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NEXTAUTH_URL: "http://localhost:3100",
            NEXTAUTH_SECRET: process.env.E2E_AUTH_SECRET!,
            BACKEND_API_URL: "http://127.0.0.1:8101",
            GITHUB_ID: "e2e-client",
            GITHUB_SECRET: "e2e-secret",
          },
        },
      ]
    : undefined,
  testDir: "./e2e",
  outputDir: join(tmpdir(), "codehunt-playwright-results"),
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    storageState: process.env.E2E_STORAGE_STATE,
    extraHTTPHeaders: { Origin: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000" },
    channel: process.env.PLAYWRIGHT_CHANNEL,
    headless: true,
    actionTimeout: 10_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
})
