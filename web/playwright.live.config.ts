import { defineConfig } from "@playwright/test";

// Explicit opt-in: these tests use a real API/database and never intercept it.
if (!process.env.E2E_BASE_URL) {
  throw new Error("Set E2E_BASE_URL to the Docker Compose web URL before running live tests.");
}
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(process.env.E2E_BASE_URL).hostname)) {
  throw new Error("Live import fixtures must run against the isolated local Docker Compose environment.");
}

export default defineConfig({
  testDir: "./tests/live",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "./test-results-live",
  reporter: [["list"], ["html", { outputFolder: "playwright-report-live", open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    ...(process.env.E2E_LIVE_TOUCH === "1"
      ? [{ name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }]
      : []),
  ],
});
