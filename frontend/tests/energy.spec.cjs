const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const path = require("path");
const pages = [
  "Command Center",
  "Live Grid",
  "Renewable Assets",
  "Battery Management",
  "AI Decisions",
  "Scenario Simulator",
  "Forecasting",
  "Optimization",
  "Decision History",
  "Analytics",
  "Alerts",
  "Settings",
];
const evidence = path.resolve(__dirname, "../../docs/evidence");
const api = "http://localhost:8000/api";
const fmt = (value, digits = 1) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
async function navigate(page, name) {
  if (
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .isVisible()
  )
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("heading", { name, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.locator("h1")).toBeFocused();
  await expect(page.locator(".skeleton")).toHaveCount(0);
}
async function start(page) {
  await page.goto("/");
  await expect(page.getByText("API connected", { exact: true })).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
}
function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

for (const width of [1920, 1440, 1024, 768, 390, 320]) {
  test(`all 12 pages responsive at ${width}px`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width, height: 900 });
    await start(page);
    for (const name of pages) {
      await navigate(page, name);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        clipped: [
          ...document.querySelectorAll(
            "main .panel,main .metric,main .scenario-card,main .flow-node,main .chart,main summary,main h2",
          ),
        ]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width && (r.right > innerWidth + 1 || r.left < -1);
          })
          .map((e) => e.className),
      }));
      expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(
        width + 1,
      );
      expect(overflow.body).toBeLessThanOrEqual(width + 1);
      expect(overflow.clipped).toEqual([]);
      for (const chart of await page.locator(".chart").all()) {
        const bounds = await chart.boundingBox();
        const canvas = await chart.locator("canvas").first().boundingBox();
        expect(canvas.width).toBeLessThanOrEqual(bounds.width + 1);
        expect(canvas.width).toBeGreaterThan(100);
      }
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: path.join(
            evidence,
            `${width}-${name.toLowerCase().replaceAll(" ", "-")}.png`,
          ),
          fullPage: true,
        });
    }
    expect(errors).toEqual([]);
  });
}

test("every page passes axe WCAG A/AA checks", async ({ page }) => {
  await start(page);
  const results = [];
  for (const name of pages) {
    await navigate(page, name);
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({ page: name, violations: scan.violations });
  }
  require("fs").writeFileSync(
    path.join(evidence, "accessibility.json"),
    JSON.stringify(results, null, 2),
  );
  expect(results.filter((r) => r.violations.length)).toEqual([]);
});

test("real API values render on dashboard, assets, batteries, grid, forecasts and analytics", async ({
  page,
  request,
}) => {
  await start(page);
  const state = await (await request.get(api + "/state")).json();
  for (const [label, key] of [
    ["Solar generation", "solar_mw"],
    ["Wind generation", "wind_mw"],
    ["Grid demand", "demand_mw"],
    ["Electricity price", "electricity_price"],
  ])
    await expect(
      page
        .locator(".metric")
        .filter({ hasText: label })
        .locator(".metric-value"),
    ).toContainText(fmt(state[key]));
  const assets = await (await request.get(api + "/assets")).json();
  await navigate(page, "Renewable Assets");
  await expect(page.locator(".asset-card")).toHaveCount(
    assets.solar_farms.length + assets.wind_farms.length,
  );
  for (const asset of [...assets.solar_farms, ...assets.wind_farms]) {
    const card = page.locator(".asset-card").filter({
      has: page.getByRole("heading", { name: asset.name, exact: true }),
    });
    await expect(card.locator(".asset-capacity")).toContainText(
      fmt(asset.capacity_mw),
    );
    await card.locator("summary").click();
    await expect(card).toContainText(asset.location);
    await card.locator("summary").press("Enter");
    await expect(card.locator("details")).not.toHaveAttribute("open");
  }
  await navigate(page, "Battery Management");
  for (const battery of assets.batteries)
    await expect(
      page.getByRole("meter", { name: `${battery.name} state of charge` }),
    ).toHaveAttribute("aria-valuenow", String(battery.current_soc * 100));
  const grid = await (await request.get(api + "/grid")).json();
  await navigate(page, "Live Grid");
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Grid frequency" })
      .locator(".metric-value"),
  ).toContainText(fmt(grid[0].grid_frequency_hz));
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Transmission capacity" })
      .locator(".metric-value"),
  ).toContainText(fmt(grid[0].transmission_capacity_mw));
  const forecasts = await (await request.get(api + "/forecasts")).json();
  await navigate(page, "Forecasting");
  for (const key of ["solar_1hr", "wind_1hr", "demand_1hr"])
    await expect(page.locator(".forecast-summary")).toContainText(
      fmt(forecasts[key]),
    );
  const analytics = await (await request.get(api + "/analytics")).json();
  await navigate(page, "Analytics");
  await expect(
    page.locator(".metric").filter({ hasText: "Cost savings" }),
  ).toContainText(fmt(analytics.cost_savings));
  await expect(
    page.locator(".metric").filter({ hasText: "Carbon reduction" }),
  ).toContainText(fmt(analytics.carbon_reduction_tons));
});

test("orchestrator POST, loading state, real decision and optimization remain connected", async ({
  page,
}) => {
  const errors = trackErrors(page);
  await start(page);
  await page.route("**/api/orchestrator/run", async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/api/orchestrator/run"),
  );
  await page.getByRole("button", { name: "Run Agentic Optimization" }).click();
  await expect(
    page.getByRole("button", { name: "Computing Optimal Dispatch..." }),
  ).toBeDisabled();
  const res = await response;
  expect(res.request().method()).toBe("POST");
  expect(res.request().postData()).toBeNull();
  const body = await res.json();
  expect(res.status()).toBe(200);
  await expect(page.getByTestId("decision-output")).toContainText(
    body.explanation,
  );
  await expect(page.getByTestId("decision-output")).toContainText(
    body.decision.action,
  );
  await navigate(page, "AI Decisions");
  await expect(page.getByTestId("decision-output").first()).toContainText(
    body.explanation,
  );
  await page
    .getByText("Optimization breakdown", { exact: true })
    .first()
    .click();
  await expect(page.getByTestId("decision-output").first()).toContainText(
    fmt(body.optimization.grid_import, 2),
  );
  await navigate(page, "Optimization");
  await expect(page.getByText("OPTIMAL", { exact: true })).toBeVisible();
  await expect(page.locator(".objective")).toContainText(
    fmt(body.optimization.objective_value, 2),
  );
  expect(errors).toEqual([]);
});

test("all ten scenario controls invoke real backend and update dashboard and audit", async ({
  page,
  request,
}) => {
  const errors = trackErrors(page);
  await start(page);
  await navigate(page, "Scenario Simulator");
  await expect(page.locator(".scenario-card")).toHaveCount(10);
  for (let id = 1; id <= 10; id++) {
    const response = page.waitForResponse((r) =>
      r.url().includes(`/api/scenarios/run?scenario_id=${id}`),
    );
    await page
      .locator(".scenario-card")
      .nth(id - 1)
      .click();
    const res = await response;
    const body = await res.json();
    expect(res.status()).toBe(200);
    expect(res.request().method()).toBe("POST");
    expect(res.request().postData()).toBeNull();
    expect(body.scenario_id).toBe(id);
    await expect(page.getByTestId("decision-output")).toContainText(
      body.explanation,
    );
    await expect(page.getByTestId("decision-output")).toContainText(
      body.message,
    );
    const audit = await (await request.get(api + "/audit")).json();
    expect(
      audit.some(
        (row) =>
          row.details.scenario_id === id &&
          row.details.explanation === body.explanation,
      ),
    ).toBeTruthy();
    await navigate(page, "Command Center");
    await expect(page.getByTestId("decision-output")).toContainText(
      body.explanation,
    );
    const state = await (await request.get(api + "/state")).json();
    await expect(
      page
        .locator(".metric")
        .filter({ hasText: "Grid demand" })
        .locator(".metric-value"),
    ).toContainText(fmt(state.demand_mw));
    await expect(
      page
        .locator(".metric")
        .filter({ hasText: "Electricity price" })
        .locator(".metric-value"),
    ).toContainText(fmt(state.electricity_price));
    await navigate(page, "Scenario Simulator");
  }
  await navigate(page, "Decision History");
  const history = await (await request.get(api + "/decisions")).json();
  await expect(page.locator(".timeline-item")).toHaveCount(history.length);
  await page.getByText("Decision details", { exact: true }).first().click();
  await expect(page.getByTestId("decision-output").first()).toContainText(
    history[0].details.explanation,
  );
  expect(errors).toEqual([]);
});

test("15-second polling continues across navigation and refresh", async ({
  page,
}) => {
  await start(page);
  await navigate(page, "Settings");
  const next = page.waitForResponse((r) => r.url().endsWith("/api/state"));
  await next;
  await expect(page.getByText("API connected", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Command Center", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("API connected", { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("decision-output").first(),
  ).toBeVisible();
});

test("mobile drawer keyboard escape, focus trap, navigation and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await start(page);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement.closest("dialog") !== null,
      ),
    ).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await navigate(page, "Scenario Simulator");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(
    await page
      .locator(".scenario-card")
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
  ).toBe("0s");
});

// Fault injection tests are explicitly isolated from the real-response tests above.
test("offline state and failed execution show errors without fabricated success", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("API unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metric").first()).toContainText("—");
  await page.getByRole("button", { name: "Run Agentic Optimization" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The agent request failed" }),
  ).toBeVisible();
  await expect(page.getByTestId("decision-output")).toHaveCount(0);
  await navigate(page, "Scenario Simulator");
  await page.locator(".scenario-card").first().click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The scenario request failed" }),
  ).toBeVisible();
});

test("stale state retains values and labels lost connection", async ({
  page,
}) => {
  await start(page);
  const before = await page.locator(".metric-value").first().textContent();
  await page.route("**/api/state", (route) => route.abort());
  await expect(page.getByText("Data stale", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.locator(".metric-value").first()).toHaveText(before);
});

test("read-only resources handle HTTP errors and empty responses explicitly", async ({
  page,
}) => {
  await page.route("**/api/assets", (route) =>
    route.fulfill({ status: 500, body: "Resource failure" }),
  );
  await start(page);
  await navigate(page, "Renewable Assets");
  await expect(
    page.getByRole("alert").filter({ hasText: "Unable to load assets" }),
  ).toBeVisible();
  await expect(
    page.getByText("Asset data unavailable", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/assets");
  await page.route("**/api/assets", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ solar_farms: [], wind_farms: [], batteries: [] }),
    }),
  );
  await navigate(page, "Settings");
  await navigate(page, "Renewable Assets");
  await expect(
    page.getByText("No assets returned", { exact: true }),
  ).toHaveCount(2);
});

test("slow real requests display loading skeletons without false values", async ({
  page,
}) => {
  await page.route("**/api/forecasts", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("status", { name: "Loading data" }).first(),
  ).toBeVisible();
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await expect(page.locator(".forecast-summary")).toBeVisible();
});

test("chart tooltips show actual units and survive repeated responsive resizing", async ({
  page,
  request,
}) => {
  await start(page);
  const state = await (await request.get(api + "/state")).json();
  for (const width of [1440, 390, 1024, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(350);
    const chart = page.locator(".chart").first();
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    await page.mouse.move(
      box.x + 56 + (box.width - 78) / 6,
      box.y + box.height - 60,
    );
    await expect(chart.getByText("Solar", { exact: true })).toBeVisible();
    await expect(chart).toContainText(String(state.solar_mw));
    await expect(chart).toContainText("MW");
    await page.mouse.move(0, 0);
  }
});

test("backend demand changes become visible through polling without a page refresh", async ({
  page,
  request,
}) => {
  await start(page);
  const before = await (await request.get(api + "/state")).json();
  // Test-only state change through the real scenario endpoint; no frontend click.
  const scenario = await request.post(api + "/scenarios/run?scenario_id=4");
  expect(scenario.status()).toBe(200);
  const response = await page.waitForResponse((r) =>
    r.url().endsWith("/api/state"),
  );
  const after = await response.json();
  expect(after.demand_mw).toBeCloseTo(before.demand_mw * 1.25, 6);
  await expect(
    page
      .locator(".metric")
      .filter({ hasText: "Grid demand" })
      .locator(".metric-value"),
  ).toContainText(fmt(after.demand_mw));
});
