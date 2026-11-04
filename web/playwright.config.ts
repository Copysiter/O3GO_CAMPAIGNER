import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 3,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    ...(process.env.E2E_WEBKIT
      ? [
          {
            name: "safari-touch",
            use: {
              ...devices["iPhone 13"],
              browserName: "webkit" as const,
            },
          },
        ]
      : []),
    {
      name: "desktop",
      use: { channel: "chrome", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "touch",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
    {
      name: "small-touch",
      use: {
        channel: "chrome",
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.E2E_DEV ? "npm run dev" : "npm start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120000,
      },
});
