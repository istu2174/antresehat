import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Setup data uji butuh service role key dari .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    // Pakai browser yang sudah terpasang (Edge ada di setiap Windows) → tidak perlu `playwright install`.
    channel: process.env.PW_CHANNEL ?? "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
