const {test, expect} = require('@playwright/test');
const api = 'http://127.0.0.1:8000/api';
const fmt = n => n.toLocaleString('en-US', {minimumFractionDigits:1, maximumFractionDigits:1});
async function nav(page, name) {
  await page.getByRole('button', {name, exact:true}).click();
  await expect(page.getByRole('heading', {name, exact:true, level:1})).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
}
async function reset(request) {
  const response = await request.post(api + '/simulation/reset');
  expect(response.ok()).toBeTruthy();
  return response.json();
}
async function begin(page,request) {
  await reset(request);
  await page.goto('/');
  await expect(page.getByText('API connected', {exact:true})).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
}
async function clickScenario(page,id) {
  const waiting = page.waitForResponse(r=>r.url().includes(`/api/scenarios/run?scenario_id=${id}`));
  await page.locator('.scenario-card').nth(id-1).click();
  const response = await waiting;
  expect(response.status()).toBe(200);
  const result = await response.json();
  await expect(page.getByTestId('decision-output')).toContainText(result.message);
  await expect(page.getByTestId('scenario-impact')).toBeVisible();
  return result;
}

test('all 10 scenarios change their advertised conditions and produce valid dispatch or explicit infeasibility', async ({page,request})=>{
  await begin(page,request);
  for (let id=1;id<=10;id++) {
    await reset(request);
    const before = await (await request.get(api+'/state')).json();
    const oldForecast = await (await request.get(api+'/forecasts')).json();
    const oldGrid = await (await request.get(api+'/grid')).json();
    await nav(page,'Scenario Simulator');
    const result = await clickScenario(page,id);
    const after = await (await request.get(api+'/state')).json();
    if (id===1 || id===10) expect(after.solar_mw).toBeCloseTo(before.solar_mw*.6,6);
    if (id===2) expect(after.wind_mw).toBeCloseTo(before.wind_mw*1.3,6);
    if (id===3) expect(after.electricity_price).toBeCloseTo(before.electricity_price*2,6);
    if (id===4) expect(after.demand_mw).toBeCloseTo(before.demand_mw*1.25,6);
    if (id===5) expect((await (await request.get(api+'/batteries')).json())[0].status).toBe('offline');
    if (id===6) expect((await (await request.get(api+'/grid')).json())[0].transmission_capacity_mw).toBeCloseTo(oldGrid[0].transmission_capacity_mw*.1,6);
    if (id===7) expect((await (await request.get(api+'/weather')).json()).status).toBe('storm warning');
    if (id===8) expect((await (await request.get(api+'/forecasts')).json()).demand_1hr).toBeCloseTo(oldForecast.demand_1hr*.8,6);
    if (id===9) expect(after.demand_mw).toBeCloseTo(before.demand_mw+200,6);
    if (id===10) expect(after.electricity_price).toBeCloseTo(before.electricity_price*1.5,6);
    const o=result.optimization;
    if(o.status==='OPTIMAL') {
      expect(o.solar_gen+o.wind_gen+o.grid_import+o.battery_discharge).toBeCloseTo(after.demand_mw+o.grid_export+o.battery_charge,6);
      expect(o.grid_import*o.grid_export).toBe(0);
      expect(o.battery_charge*o.battery_discharge).toBe(0);
    } else {
      expect(o.status).toBe('INFEASIBLE');
      expect(result.decision.action).toBe('review_required');
      await expect(page.getByTestId('decision-output')).toContainText('No feasible dispatch');
    }
    await nav(page,'Command Center');
    for (const [label,key] of [['Grid demand','demand_mw'],['Solar generation','solar_mw'],['Wind generation','wind_mw'],['Electricity price','electricity_price']])
      await expect(page.locator('.metric').filter({hasText:label}).locator('.metric-value')).toContainText(fmt(after[key]));
  }
  await reset(request);
});

test('demand click immediately refreshes dashboard and forecast; dispatch survives reload in history', async ({page,request})=>{
  await begin(page,request);
  await nav(page,'Scenario Simulator');
  const result=await clickScenario(page,4);
  await nav(page,'Command Center');
  await expect(page.locator('.metric').filter({hasText:'Grid demand'})).toContainText(fmt(result.after.demand_mw));
  await nav(page,'Forecasting');
  await expect(page.locator('.forecast-summary')).toContainText(fmt(result.after.demand_mw*1.05));
  await page.reload();
  await expect(page.getByTestId('decision-output')).toContainText(result.explanation);
  await nav(page,'Decision History');
  await expect(page.locator('.timeline-item').first()).toContainText(result.message);
  await page.getByText('Decision details',{exact:true}).first().click();
  await expect(page.getByTestId('decision-output').first()).toContainText(result.explanation);
});

test('storm and battery scenarios display operational alerts and asset availability', async ({page,request})=>{
  await begin(page,request);
  await nav(page,'Scenario Simulator');
  await clickScenario(page,5);
  await nav(page,'Battery Management');
  await expect(page.getByText('offline',{exact:true})).toBeVisible();
  await nav(page,'Scenario Simulator');
  await clickScenario(page,7);
  await nav(page,'Alerts');
  await expect(page.getByText('Storm warning: simulated renewable availability reduced.',{exact:true})).toBeVisible();
  await expect(page.getByText(/is offline and excluded from dispatch/)).toBeVisible();
});

test('settings save through UI, survive reload and affect battery reserve in the next recommendation', async ({page,request})=>{
  await begin(page,request);
  const original=await (await request.get(api+'/settings')).json();
  try {
    await nav(page,'Settings');
    await page.getByLabel('Cost weight',{exact:true}).fill('2');
    await page.getByLabel('Carbon weight',{exact:true}).fill('3');
    await page.getByLabel('Battery reserve (%)',{exact:true}).fill('100');
    await page.getByRole('button',{name:'Save settings',exact:true}).click();
    await expect(page.getByText('Settings saved. They apply to the next optimization.',{exact:true})).toBeVisible();
    await page.reload();
    await nav(page,'Settings');
    await expect(page.getByLabel('Battery reserve (%)',{exact:true})).toHaveValue('100');
    await nav(page,'Command Center');
    const response=page.waitForResponse(r=>r.url().endsWith('/api/orchestrator/run'));
    await page.getByRole('button',{name:'Run Agentic Optimization',exact:true}).click();
    expect((await (await response).json()).optimization.battery_discharge).toBe(0);
  } finally {
    await request.put(api+'/settings',{data:original});
    await reset(request);
  }
});

test('reset restores the initial demo state and keeps history', async ({page,request})=>{
  await begin(page,request);
  const before=await (await request.get(api+'/state')).json();
  await nav(page,'Scenario Simulator');
  await clickScenario(page,4);
  const historyBefore=(await (await request.get(api+'/audit')).json()).length;
  const response=page.waitForResponse(r=>r.url().endsWith('/api/simulation/reset'));
  await page.getByRole('button',{name:'Reset simulation',exact:true}).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByTestId('decision-output')).toContainText('Simulation reset to starting conditions');
  expect(await (await request.get(api+'/state')).json()).toEqual(before);
  expect((await (await request.get(api+'/audit')).json()).length).toBe(historyBefore+1);
});

test('scenario buttons disable while a real request is pending to prevent double injections', async ({page,request})=>{
  await begin(page,request);
  await nav(page,'Scenario Simulator');
  let calls=0;
  await page.route('**/api/scenarios/run?scenario_id=4', async route=>{
    calls++;
    await new Promise(r=>setTimeout(r,500));
    await route.continue();
  });
  const response=page.waitForResponse(r=>r.url().includes('/api/scenarios/run?scenario_id=4'));
  const button=page.locator('.scenario-card').nth(3);
  await button.click();
  await expect(button).toBeDisabled();
  await button.evaluate(element=>element.click());
  await response;
  await expect(button).toBeEnabled();
  expect(calls).toBe(1);
  await reset(request);
});

test('clicking a scenario brings its updated result into view without manual scrolling', async ({page,request})=>{
  await begin(page,request);
  await page.emulateMedia({reducedMotion:'reduce'});
  await nav(page,'Scenario Simulator');
  await clickScenario(page,4);
  const region=page.getByRole('region',{name:'Scenario result'});
  await expect(region).toBeInViewport();
  await expect(region).toContainText('Grid demand increased 25%');
  await expect(region.getByTestId('scenario-impact')).toBeVisible();
  await reset(request);
});
