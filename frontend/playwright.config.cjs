const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  use: {
    baseURL: process.env.ENERGY_UI_URL || "http://127.0.0.1:5173",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: process.env.ENERGY_PRODUCTION
    ? "../docs/evidence/production-browser-results"
    : "../docs/evidence/browser-results",
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: process.env.ENERGY_PRODUCTION
          ? "../docs/evidence/production-playwright-results.json"
          : "../docs/evidence/playwright-results.json",
      },
    ],
  ],
});
