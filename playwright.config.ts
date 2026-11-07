import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "./node_modules/.bin/cf dev",
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 120_000, // cf dev inherits PORT from this process
  },
});
