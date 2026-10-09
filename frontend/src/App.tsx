import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Squares2X2Icon,
  BoltIcon,
  SunIcon,
  Battery50Icon,
  CpuChipIcon,
  BeakerIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
  PresentationChartLineIcon,
  BellIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  CloudIcon,
  SignalIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import type { ElementType, KeyboardEvent, CSSProperties } from "react";
import type { EChartsOption } from "echarts";
import type {
  SystemState,
  DecisionResult,
  Assets,
  GridRecord,
  MarketRecord,
  Forecasts,
  AuditRecord,
  Weather,
  Analytics,
} from "./types";
import { useResource } from "./hooks/useResource";
import {
  Badge,
  Panel,
  Metric,
  Empty,
  ResourceFeedback,
  DataList,
  TextLink,
  number,
  timestamp,
} from "./components/ui";
import { Chart, barOption } from "./components/Chart";
import { EnergyFlow } from "./components/EnergyFlow";
import { DecisionOutput, OptimizationOutput } from "./components/Decision";

const navigation: {
  name: string;
  icon: ElementType;
  group: string;
  description: string;
}[] = [
  {
    name: "Command Center",
    icon: Squares2X2Icon,
    group: "Operations",
    description: "Your renewable portfolio. One operational perspective.",
  },
  {
    name: "Live Grid",
    icon: BoltIcon,
    group: "Operations",
    description:
      "Grid conditions, interconnection capacity, and market signals.",
  },
  {
    name: "Renewable Assets",
    icon: SunIcon,
    group: "Operations",
    description: "Solar and wind infrastructure across your portfolio.",
  },
  {
    name: "Battery Management",
    icon: Battery50Icon,
    group: "Operations",
    description:
      "Storage capacity, charge limits, and available battery telemetry.",
  },
  {
    name: "AI Decisions",
    icon: CpuChipIcon,
    group: "Intelligence",
    description: "Understand the selected action and the reasoning behind it.",
  },
  {
    name: "Scenario Simulator",
    icon: BeakerIcon,
    group: "Intelligence",
    description:
      "Stress-test operating conditions through the existing agent pipeline.",
  },
  {
    name: "Forecasting",
    icon: ChartBarIcon,
    group: "Intelligence",
    description:
      "Available renewable and demand outlook from the forecast API.",
  },
  {
    name: "Optimization",
    icon: AdjustmentsHorizontalIcon,
    group: "Intelligence",
    description: "Dispatch strategy and constrained optimization results.",
  },
  {
    name: "Decision History",
    icon: ClockIcon,
    group: "Workspace",
    description: "Trace scenario events and their recorded agent decisions.",
  },
  {
    name: "Analytics",
    icon: PresentationChartLineIcon,
    group: "Workspace",
    description: "Portfolio indicators and available operational measurements.",
  },
  {
    name: "Alerts",
    icon: BellIcon,
    group: "Workspace",
    description: "Alert availability and environmental context.",
  },
  {
    name: "Settings",
    icon: Cog6ToothIcon,
    group: "Workspace",
    description: "Inspect application configuration and environment details.",
  },
];
const scenarios = [
  {
    id: 1,
    title: "Solar Drop -40%",
    description: "Sudden cloud cover across solar assets.",
    icon: SunIcon,
    tone: "amber",
    category: "Generation",
  },
  {
    id: 2,
    title: "Wind Spike +30%",
    description: "Unexpected wind conditions boost generation.",
    icon: CloudIcon,
    tone: "cyan",
    category: "Generation",
  },
  {
    id: 3,
    title: "Price Spike +100%",
    description: "Wholesale electricity prices double.",
    icon: ChartBarIcon,
    tone: "red",
    category: "Market",
  },
  {
    id: 4,
    title: "Demand Spike +25%",
    description: "Increased grid demand requires a new strategy.",
    icon: BoltIcon,
    tone: "amber",
    category: "Demand",
  },
  {
    id: 5,
    title: "Battery B1 Failure",
    description: "Main battery storage becomes unavailable.",
    icon: Battery50Icon,
    tone: "red",
    category: "Storage",
  },
  {
    id: 6,
    title: "Transmission Limit",
    description: "A constrained transmission interconnection.",
    icon: SignalIcon,
    tone: "cyan",
    category: "Grid",
  },
  {
    id: 7,
    title: "Storm Warning",
    description: "Incoming storm event challenges resilience.",
    icon: CloudIcon,
    tone: "amber",
    category: "Weather",
  },
  {
    id: 8,
    title: "Forecast Deviation",
    description: "Weather outlook changes unexpectedly.",
    icon: ChartBarIcon,
    tone: "cyan",
    category: "Forecast",
  },
  {
    id: 9,
    title: "Industrial Load Spike",
    description: "An unforecasted industrial load increase.",
    icon: BoltIcon,
    tone: "red",
    category: "Demand",
  },
];

function App() {
  const [activePage, setActivePage] = useState("Command Center");
  const [state, setState] = useState<SystemState | null>(null);
  const [orchestratorResult, setOrchestratorResult] =
    useState<DecisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stateError, setStateError] = useState("");
  const [actionError, setActionError] = useState("");
  const [receivedAt, setReceivedAt] = useState<Date | null>(null);
  const [pendingScenarios, setPendingScenarios] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const command = activePage === "Command Center";
  const assets = useResource<Assets>(
    "assets",
    command ||
      ["Renewable Assets", "Battery Management", "Analytics"].includes(
        activePage,
      ),
  );
  const grid = useResource<GridRecord[]>(
    "grid",
    command || ["Live Grid", "Forecasting", "Analytics"].includes(activePage),
  );
  const market = useResource<MarketRecord[]>(
    "market",
    activePage === "Live Grid" || activePage === "Analytics",
  );
  const forecasts = useResource<Forecasts>(
    "forecasts",
    command || activePage === "Forecasting",
  );
  const history = useResource<AuditRecord[]>(
    "decisions",
    command ||
      activePage === "AI Decisions" ||
      activePage === "Decision History",
  );
  const weather = useResource<Weather>(
    "weather",
    activePage === "Live Grid" || activePage === "Alerts",
  );
  const analytics = useResource<Analytics>(
    "analytics",
    activePage === "Analytics",
  );
  const actions = useResource<unknown[]>(
    "actions",
    activePage === "AI Decisions",
  );
  const latestGrid = grid.data?.[0];
  const latestMarket = market.data?.[0];

  useEffect(() => {
    const controller = new AbortController();
    void fetchState(controller.signal);
    const interval = setInterval(() => fetchState(controller.signal), 15000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (menuOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [menuOpen]);

  const fetchState = async (signal?: AbortSignal) => {
    try {
      const res = await axios.get<SystemState>(
        "http://localhost:8000/api/state",
        { signal },
      );
      setState(res.data);
      setStateError("");
      setReceivedAt(new Date());
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error("Error fetching state:", error);
      setStateError(
        "System state is unavailable. Check that FastAPI is running on localhost:8000.",
      );
    }
  };

  const runOrchestrator = async () => {
    setLoading(true);
    setActionError("");
    try {
      const res = await axios.post<DecisionResult>(
        "http://localhost:8000/api/orchestrator/run",
      );
      setOrchestratorResult(res.data);
    } catch (error) {
      console.error("Error running orchestrator:", error);
      setActionError("The agent request failed. No new decision was received.");
    }
    setLoading(false);
  };

  const runScenario = async (id: number) => {
    setPendingScenarios((value) => value + 1);
    setActionError("");
    try {
      const res = await axios.post<DecisionResult>(
        `http://localhost:8000/api/scenarios/run?scenario_id=${id}`,
      );
      setOrchestratorResult(res.data);
      void fetchState();
    } catch (error) {
      console.error("Error running scenario:", error);
      setActionError(
        "The scenario request failed. Check the backend before retrying; the event may already have been recorded.",
      );
    } finally {
      setPendingScenarios((value) => value - 1);
    }
  };

  const trapDrawerFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ),
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const navigate = (page: string) => {
    setActivePage(page);
    setMenuOpen(false);
    window.requestAnimationFrame(() => pageHeading.current?.focus());
  };
  const current = navigation.find((item) => item.name === activePage)!;
  const navigationContent = (
    <>
      <div className="brand">
        <div className="brand-symbol">
          <BoltIcon />
        </div>
        <div>
          <strong>
            NEXUS<span>GRID</span>
          </strong>
          <small>ENERGY INTELLIGENCE</small>
        </div>
      </div>
      <nav aria-label="Main navigation">
        {["Operations", "Intelligence", "Workspace"].map((group) => (
          <div className="nav-group" key={group}>
            <p className="nav-label">{group}</p>
            {navigation
              .filter((item) => item.group === group)
              .map(({ name, icon: Icon }) => (
                <button
                  key={name}
                  onClick={() => navigate(name)}
                  aria-current={activePage === name ? "page" : undefined}
                  className={`nav-item ${activePage === name ? "is-active" : ""}`}
                >
                  <Icon />
                  <span>{name}</span>
                  {activePage === name && <span className="nav-indicator" />}
                </button>
              ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <ShieldCheckIcon />
        <div>
          <strong>Simulation workspace</strong>
          <span>No physical grid control</span>
        </div>
      </div>
    </>
  );

  const energyChart = state
    ? barOption(
        ["Solar", "Wind", "Demand"],
        [state.solar_mw, state.wind_mw, state.demand_mw],
      )
    : null;
  const gridChart: EChartsOption | null = grid.data?.length
    ? {
        grid: { left: 54, right: 18, top: 25, bottom: 65 },
        tooltip: { trigger: "axis", valueFormatter: (value) => `${value} MW` },
        xAxis: {
          type: "category",
          data: [...grid.data].reverse().map((row) => timestamp(row.timestamp)),
          axisLabel: { formatter: (value: string) => value.slice(11, 16) },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          name: "MW",
          splitLine: { lineStyle: { color: "#20313d" } },
        },
        series: [
          {
            name: "Grid demand",
            type: "line",
            showSymbol: grid.data.length < 3,
            data: [...grid.data].reverse().map((row) => row.current_demand_mw),
            lineStyle: { width: 2 },
            areaStyle: { opacity: 0.07 },
          },
        ],
      }
    : null;
  const forecastSummary = (
    <>
      <ResourceFeedback {...forecasts} />
      {forecasts.data ? (
        <div className="forecast-summary">
          {[
            ["Solar", forecasts.data.solar_1hr, "amber"],
            ["Wind", forecasts.data.wind_1hr, "cyan"],
            ["Demand", forecasts.data.demand_1hr, "green"],
          ].map(([label, value, tone]) => (
            <div key={label as string}>
              <span>
                <i className={`legend-dot color-${tone}`} />
                {label}
              </span>
              <strong>
                {number(value as number)} <small>MW</small>
              </strong>
            </div>
          ))}
        </div>
      ) : (
        !forecasts.loading && (
          <Empty title="Forecast unavailable">
            No forecast response has been received.
          </Empty>
        )
      )}
      <p className="helper">1-hour API outlook · backend demo values</p>
    </>
  );
  const records = (list: AuditRecord[] | null, compact = false) =>
    list?.length ? (
      <div className="timeline">
        {(compact ? list.slice(0, 3) : list).map((row) => (
          <article key={row.id} className="timeline-item">
            <span className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-title">
                <h3>{row.event}</h3>
                <Badge>#{row.id}</Badge>
              </div>
              <time>{timestamp(row.timestamp)} · source time</time>
              {!compact && (
                <details className="details">
                  <summary>Decision details</summary>
                  <DecisionOutput
                    result={{
                      decision: row.details?.decision,
                      explanation: row.details?.explanation,
                      optimization: row.details?.optimization_result,
                    }}
                  />
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
    ) : (
      <Empty title="No recorded decisions">
        Scenario audit records appear here when the backend returns them.
        Standalone agent runs do not currently create audit records.
      </Empty>
    );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">{navigationContent}</aside>
      <dialog
        ref={dialog}
        className="mobile-navigation"
        aria-label="Navigation"
        onKeyDown={trapDrawerFocus}
        onCancel={() => setMenuOpen(false)}
        onClick={(event) => {
          if (event.target === dialog.current) setMenuOpen(false);
        }}
      >
        <button
          className="icon-button drawer-close"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        >
          <XMarkIcon />
        </button>
        {navigationContent}
      </dialog>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Bars3Icon />
            </button>
            <span className="workspace-name">
              Renewable Energy Orchestrator
            </span>
            <span className="topbar-divider" />
            <Badge tone="amber">SIMULATION</Badge>
          </div>
          <div className="connection" role="status">
            <span
              className={`status-dot ${stateError ? "warning" : state ? "connected" : ""}`}
            />
            <span>
              {stateError
                ? state
                  ? "Data stale"
                  : "API unavailable"
                : state
                  ? "API connected"
                  : "Connecting"}
            </span>
          </div>
        </header>
        <main id="main-content" className="main-content">
          <div className="page-heading">
            <div>
              <p className="breadcrumb">
                Workspace <span>/</span> {current.group}
              </p>
              <h1 ref={pageHeading} tabIndex={-1}>
                {activePage}
                <span className="heading-dot" />
              </h1>
              <p className="page-description">{current.description}</p>
            </div>
            <div className="page-meta">
              <span className="meta-label">SYSTEM SNAPSHOT</span>
              <span>
                {receivedAt
                  ? `Received ${receivedAt.toLocaleTimeString()}`
                  : "Awaiting response"}
              </span>
              <small>Refreshes every 15 seconds</small>
            </div>
          </div>
          {stateError && (
            <p className="notice notice-warning" role="alert">
              {stateError}
              {state ? " Last received values are shown." : ""}
            </p>
          )}
          {actionError && (
            <p className="notice notice-danger" role="alert">
              {actionError}
            </p>
          )}

          {command && (
            <div className="page-stack">
              <div className="section-bar">
                <span className="eyebrow">Portfolio overview</span>
                <span className="muted">API-provided simulation data</span>
              </div>
              <div className="metric-grid">
                <Metric
                  label="Solar generation"
                  value={state?.solar_mw}
                  unit="MW"
                  caption="Current system output"
                  tone="amber"
                  icon={<SunIcon />}
                />
                <Metric
                  label="Wind generation"
                  value={state?.wind_mw}
                  unit="MW"
                  caption="Current system output"
                  tone="cyan"
                  icon={<CloudIcon />}
                />
                <Metric
                  label="Grid demand"
                  value={state?.demand_mw}
                  unit="MW"
                  caption="Latest recorded demand"
                  icon={<BoltIcon />}
                />
                <Metric
                  label="Electricity price"
                  value={state?.electricity_price}
                  unit="$/MWh"
                  caption="Latest market price"
                  tone="violet"
                  icon={<ChartBarIcon />}
                />
              </div>
              <div className="command-grid">
                <div className="page-stack">
                  <Panel
                    title="Energy balance"
                    eyebrow="Generation & demand"
                    trailing={<Badge tone="green">Snapshot</Badge>}
                  >
                    <EnergyFlow state={state} />
                    <div className="panel-divider" />
                    <div className="chart-heading">
                      <h3>Generation vs. demand</h3>
                      <div className="legend">
                        <span>
                          <i className="legend-dot color-amber" />
                          Solar
                        </span>
                        <span>
                          <i className="legend-dot color-cyan" />
                          Wind
                        </span>
                        <span>
                          <i className="legend-dot color-green" />
                          Demand
                        </span>
                      </div>
                    </div>
                    {energyChart ? (
                      <Chart
                        option={energyChart}
                        label={`Solar ${number(state?.solar_mw)} MW, wind ${number(state?.wind_mw)} MW, demand ${number(state?.demand_mw)} MW`}
                        height={230}
                      />
                    ) : (
                      <Empty title="Awaiting system data">
                        The energy chart will appear when the API responds.
                      </Empty>
                    )}
                    <p className="helper">
                      Generation and demand snapshot. Grid imports, exports, and
                      battery power are not provided by the state API.
                    </p>
                  </Panel>
                  <Panel
                    title="Recent activity"
                    eyebrow="Decision log"
                    trailing={
                      <TextLink onClick={() => navigate("Decision History")}>
                        View history
                      </TextLink>
                    }
                  >
                    <ResourceFeedback {...history} />
                    {records(history.data, true)}
                  </Panel>
                </div>
                <div className="page-stack">
                  <Panel
                    title="Agent orchestration"
                    eyebrow="Decision intelligence"
                    className="agent-panel"
                    trailing={
                      <CpuChipIcon className="panel-icon color-green" />
                    }
                  >
                    <p className="panel-description">
                      Evaluate conditions and receive an optimal dispatch
                      recommendation from the agent pipeline.
                    </p>
                    <div className="agent-stages">
                      <span>Observe</span>
                      <ArrowRightIcon />
                      <span>Optimize</span>
                      <ArrowRightIcon />
                      <span>Explain</span>
                    </div>
                    <button
                      className="primary-button"
                      onClick={runOrchestrator}
                      disabled={loading}
                    >
                      {loading ? (
                        <ArrowPathIcon className="spin" />
                      ) : (
                        <BoltIcon />
                      )}
                      {loading
                        ? "Computing Optimal Dispatch..."
                        : "Run Agentic Optimization"}
                    </button>
                    <div role="status" aria-live="polite">
                      {loading && (
                        <p className="helper">
                          Waiting for the orchestration response…
                        </p>
                      )}
                    </div>
                    <DecisionOutput result={orchestratorResult} compact />
                    <p className="helper">
                      Recommendations are simulated. No physical grid actions
                      are executed.
                    </p>
                  </Panel>
                  <Panel
                    title="Next-hour outlook"
                    eyebrow="Forecast snapshot"
                    trailing={
                      <TextLink onClick={() => navigate("Forecasting")}>
                        Explore
                      </TextLink>
                    }
                  >
                    {forecastSummary}
                  </Panel>
                  <Panel
                    title="Storage & portfolio"
                    eyebrow="Operational context"
                  >
                    <ResourceFeedback {...assets} />
                    <DataList
                      rows={[
                        [
                          "Average battery SOC",
                          `${number(state?.battery_soc)}%`,
                        ],
                        [
                          "Solar assets",
                          assets.data?.solar_farms.length ?? "—",
                        ],
                        ["Wind assets", assets.data?.wind_farms.length ?? "—"],
                        [
                          "Battery systems",
                          assets.data?.batteries.length ?? "—",
                        ],
                      ]}
                    />
                    <p className="helper">
                      Reliability, risk, and carbon telemetry are not provided
                      by the system-state API.
                    </p>
                  </Panel>
                </div>
              </div>
            </div>
          )}

          {activePage === "Live Grid" && (
            <div className="page-stack">
              <ResourceFeedback {...grid} />
              <ResourceFeedback {...market} />
              <div className="metric-grid">
                <Metric
                  label="Grid demand"
                  value={latestGrid?.current_demand_mw}
                  unit="MW"
                  caption="Latest grid record"
                />
                <Metric
                  label="Grid frequency"
                  value={latestGrid?.grid_frequency_hz}
                  unit="Hz"
                  caption="Reported frequency"
                  tone="cyan"
                  icon={<SignalIcon />}
                />
                <Metric
                  label="Transmission capacity"
                  value={latestGrid?.transmission_capacity_mw}
                  unit="MW"
                  caption="Recorded capacity limit"
                  tone="amber"
                />
                <Metric
                  label="Market price"
                  value={latestMarket?.electricity_price_mwh}
                  unit="$/MWh"
                  caption="Latest market record"
                  tone="violet"
                />
              </div>
              <Panel title="Generation & demand" eyebrow="Grid overview">
                <EnergyFlow state={state} />
                <p className="helper">
                  Source snapshot only. Transmission utilization, grid health,
                  and current import/export telemetry are unavailable.
                </p>
              </Panel>
              <div className="two-column">
                <Panel title="Demand history" eyebrow="Latest 10 records">
                  {gridChart ? (
                    <Chart
                      option={gridChart}
                      label="Demand from the latest ten grid records in source timestamp order"
                    />
                  ) : (
                    <Empty title="No grid records">
                      Demand history will appear when records are returned.
                    </Empty>
                  )}
                  <p className="helper">
                    {timestamp(latestGrid?.timestamp)} · source time (timezone
                    not supplied)
                  </p>
                </Panel>
                <Panel title="Market & environment" eyebrow="Operating context">
                  <ResourceFeedback {...weather} />
                  <DataList
                    rows={[
                      [
                        "Carbon price",
                        `${number(latestMarket?.carbon_price_ton)} $/ton`,
                      ],
                      [
                        "Demand response incentive",
                        number(latestMarket?.demand_response_incentive),
                      ],
                      ["Weather", weather.data?.status || "—"],
                      [
                        "Temperature",
                        `${number(weather.data?.temperature_c)} °C`,
                      ],
                      [
                        "Wind speed",
                        `${number(weather.data?.wind_speed_ms)} m/s`,
                      ],
                    ]}
                  />
                  <p className="helper">
                    Weather is a fixed demo response from the existing backend.
                  </p>
                </Panel>
              </div>
            </div>
          )}

          {activePage === "Renewable Assets" && (
            <div className="page-stack">
              <ResourceFeedback {...assets} />
              <div className="section-bar">
                <span className="eyebrow">Renewable infrastructure</span>
                <Badge>
                  {assets.data
                    ? assets.data.solar_farms.length +
                      assets.data.wind_farms.length
                    : "—"}{" "}
                  assets
                </Badge>
              </div>
              {assets.data ? (
                <>
                  {[
                    {
                      title: "Solar portfolio",
                      rows: assets.data.solar_farms,
                      Icon: SunIcon,
                      tone: "amber",
                    },
                    {
                      title: "Wind portfolio",
                      rows: assets.data.wind_farms,
                      Icon: CloudIcon,
                      tone: "cyan",
                    },
                  ].map(({ title, rows, Icon, tone }) => (
                    <Panel
                      key={title}
                      title={title}
                      eyebrow="Asset register"
                      trailing={<Badge>{rows.length} farms</Badge>}
                    >
                      <div className="asset-grid">
                        {rows.map((asset) => (
                          <article className="asset-card" key={asset.id}>
                            <div className="asset-top">
                              <span className={`asset-icon color-${tone}`}>
                                <Icon />
                              </span>
                              <Badge
                                tone={
                                  asset.status === "active" ? "green" : "amber"
                                }
                              >
                                {asset.status || "Unknown"}
                              </Badge>
                            </div>
                            <h3>{asset.name}</h3>
                            <p className="muted">
                              {asset.location || "Location unavailable"}
                            </p>
                            <p className="asset-capacity">
                              {number(asset.capacity_mw)} <small>MW</small>
                            </p>
                            <span className="helper">Installed capacity</span>
                            <details className="details">
                              <summary>Details</summary>
                              <DataList
                                rows={[
                                  ["Asset ID", asset.id],
                                  ["Location", asset.location],
                                  ["Status", asset.status],
                                ]}
                              />
                              <p className="helper">
                                Per-asset generation, utilization, performance
                                history, and maintenance schedules are not
                                exposed by this endpoint.
                              </p>
                            </details>
                          </article>
                        ))}
                      </div>
                      {!rows.length && (
                        <Empty title="No assets returned">
                          The asset register is empty.
                        </Empty>
                      )}
                    </Panel>
                  ))}
                </>
              ) : (
                !assets.loading && (
                  <Panel title="Asset register">
                    <Empty title="Asset data unavailable">
                      Connect the backend to load the existing solar and wind
                      portfolio.
                    </Empty>
                  </Panel>
                )
              )}
            </div>
          )}

          {activePage === "Battery Management" && (
            <div className="page-stack">
              <ResourceFeedback {...assets} />
              <div className="section-bar">
                <span className="eyebrow">Energy storage</span>
                <Badge>
                  {assets.data?.batteries.length ?? "—"} battery systems
                </Badge>
              </div>
              <div className="two-column">
                {assets.data?.batteries.map((battery) => (
                  <Panel
                    key={battery.id}
                    title={battery.name}
                    eyebrow="Battery system"
                    trailing={
                      <Badge
                        tone={battery.status === "active" ? "green" : "amber"}
                      >
                        {battery.status || "Unknown"}
                      </Badge>
                    }
                  >
                    <div className="battery-overview">
                      <div
                        className="battery-gauge"
                        style={
                          {
                            "--soc": `${Math.max(0, Math.min(100, battery.current_soc * 100))}%`,
                          } as CSSProperties
                        }
                      >
                        <Battery50Icon />
                        <strong>
                          {number(battery.current_soc * 100)}
                          <small>%</small>
                        </strong>
                        <span>State of charge</span>
                      </div>
                      <div>
                        <p className="eyebrow">Rated energy capacity</p>
                        <p className="asset-capacity">
                          {number(battery.capacity_mwh)} <small>MWh</small>
                        </p>
                        <p className="helper">
                          Current charge/discharge power is not reported.
                        </p>
                      </div>
                    </div>
                    <div
                      className="soc-track"
                      role="meter"
                      aria-label={`${battery.name} state of charge`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={battery.current_soc * 100}
                    >
                      <span
                        style={{
                          width: `${Math.max(0, Math.min(100, battery.current_soc * 100))}%`,
                        }}
                      />
                    </div>
                    <DataList
                      rows={[
                        [
                          "Maximum charge rate",
                          `${number(battery.max_charge_rate_mw)} MW`,
                        ],
                        [
                          "Maximum discharge rate",
                          `${number(battery.max_discharge_rate_mw)} MW`,
                        ],
                        [
                          "Charge efficiency",
                          `${number(battery.charge_efficiency * 100)}%`,
                        ],
                        [
                          "Degradation factor",
                          number(battery.degradation_factor, 3),
                        ],
                      ]}
                    />
                    <p className="helper">
                      Reserve, battery health scores, and SOC history are not
                      provided by this API.
                    </p>
                  </Panel>
                ))}
              </div>
              {!assets.loading && !assets.data?.batteries.length && (
                <Panel title="Storage overview">
                  <Empty title="No battery data">
                    Battery systems appear when the asset API returns records.
                  </Empty>
                </Panel>
              )}
            </div>
          )}

          {activePage === "AI Decisions" && (
            <div className="page-stack">
              <div className="two-column">
                <Panel
                  title="Current decision"
                  eyebrow="Agent response"
                  trailing={<Badge tone="cyan">Simulation</Badge>}
                >
                  <DecisionOutput result={orchestratorResult} />
                  <TextLink onClick={() => navigate("Command Center")}>
                    Open agent controls
                  </TextLink>
                </Panel>
                <Panel title="Human oversight" eyebrow="Action queue">
                  <ResourceFeedback {...actions} />
                  <Empty
                    title={
                      actions.data?.length
                        ? "Action records returned"
                        : "No pending actions"
                    }
                    icon={<ShieldCheckIcon />}
                  >
                    The existing action API returns no actionable approval
                    queue. Risk classification and persistent approval or
                    rejection are not implemented.
                  </Empty>
                  {!!actions.data?.length && (
                    <pre>{JSON.stringify(actions.data, null, 2)}</pre>
                  )}
                </Panel>
              </div>
              <Panel
                title="Recorded reasoning"
                eyebrow="Recent scenario decisions"
              >
                <ResourceFeedback {...history} />
                {records(history.data)}
              </Panel>
            </div>
          )}

          {activePage === "Scenario Simulator" && (
            <div className="page-stack">
              <div className="simulation-banner">
                <BeakerIcon />
                <div>
                  <strong>Explore the unexpected.</strong>
                  <p>
                    Each scenario invokes the existing backend, records its
                    event, and requests a new agent decision.
                  </p>
                </div>
                <Badge tone="amber">Simulated execution</Badge>
              </div>
              <div className="section-bar">
                <span className="eyebrow">Select a scenario</span>
                <span className="muted">9 existing execution controls</span>
              </div>
              <div className="scenario-grid">
                {scenarios.map(
                  ({ id, title, description, icon: Icon, tone, category }) => (
                    <button
                      key={id}
                      onClick={() => runScenario(id)}
                      className={`scenario-card scenario-${tone}`}
                    >
                      <div className="scenario-top">
                        <span className="scenario-icon">
                          <Icon />
                        </span>
                        <span className="scenario-index">
                          {String(id).padStart(2, "0")}
                        </span>
                      </div>
                      <span className="scenario-category">{category}</span>
                      <h2>{title}</h2>
                      <p>{description}</p>
                      <div className="scenario-action">
                        Run scenario <ArrowRightIcon />
                      </div>
                    </button>
                  ),
                )}
              </div>
              <div className="scenario-unavailable">
                <span className="scenario-index">10</span>
                <div>
                  <strong>Multiple simultaneous events</strong>
                  <p>
                    Backend-only scenario; no execution control exists in the
                    original frontend.
                  </p>
                </div>
                <Badge>Unavailable in UI</Badge>
              </div>
              <p className="helper">
                Some backend scenarios currently record an event without
                changing its corresponding telemetry. The returned decision is
                shown as received.
              </p>
              <Panel
                title="Simulation result"
                eyebrow="Backend response"
                trailing={
                  <Badge tone={pendingScenarios ? "amber" : "neutral"}>
                    {pendingScenarios
                      ? "Running"
                      : orchestratorResult
                        ? "Response received"
                        : "Awaiting execution"}
                  </Badge>
                }
              >
                <div role="status" aria-live="polite">
                  {pendingScenarios > 0 && (
                    <p className="notice">
                      <ArrowPathIcon className="spin" />
                      Waiting for {pendingScenarios} scenario{" "}
                      {pendingScenarios === 1 ? "response" : "responses"}…
                    </p>
                  )}
                </div>
                <DecisionOutput result={orchestratorResult} />
                <p className="helper">
                  Results share the existing current-decision state.
                  Before/after impact metrics and execution stage progress are
                  not returned by this API.
                </p>
              </Panel>
            </div>
          )}

          {activePage === "Forecasting" && (
            <div className="page-stack">
              <div className="section-bar">
                <span className="eyebrow">Forecast outlook</span>
                <Badge tone="cyan">1-hour horizon</Badge>
              </div>
              <Panel
                title="Renewable & demand forecast"
                eyebrow="API forecast values"
              >
                {forecastSummary}
                {forecasts.data && (
                  <Chart
                    option={barOption(
                      ["Solar forecast", "Wind forecast", "Demand forecast"],
                      [
                        forecasts.data.solar_1hr,
                        forecasts.data.wind_1hr,
                        forecasts.data.demand_1hr,
                      ],
                    )}
                    label={`One-hour API forecasts: solar ${number(forecasts.data.solar_1hr)} MW, wind ${number(forecasts.data.wind_1hr)} MW, demand ${number(forecasts.data.demand_1hr)} MW`}
                  />
                )}
              </Panel>
              <div className="two-column">
                <Panel title="Recorded demand" eyebrow="Historical context">
                  <ResourceFeedback {...grid} />
                  {gridChart ? (
                    <Chart
                      option={gridChart}
                      label="Actual recorded grid demand, separate from the forecast"
                    />
                  ) : (
                    <Empty title="No history received">
                      Grid records are unavailable.
                    </Empty>
                  )}
                </Panel>
                <Panel
                  title="Forecast coverage"
                  eyebrow="Available capabilities"
                >
                  <DataList
                    rows={[
                      ["Solar / wind / demand", "Single 1-hour value"],
                      ["Forecast timestamps", "Not supplied"],
                      ["Price forecast", "Not supplied"],
                      ["Uncertainty intervals", "Not supplied"],
                      ["Selectable horizons", "Not implemented"],
                    ]}
                  />
                  <p className="helper">
                    The backend currently returns fixed forecast values. These
                    are not trained-model predictions or live weather forecasts.
                  </p>
                </Panel>
              </div>
            </div>
          )}

          {activePage === "Optimization" && (
            <div className="page-stack">
              <div className="two-column">
                <Panel title="Selected dispatch" eyebrow="OR-Tools result">
                  <OptimizationOutput
                    result={orchestratorResult?.optimization}
                  />
                  <TextLink onClick={() => navigate("Command Center")}>
                    Open agent controls
                  </TextLink>
                </Panel>
                <Panel
                  title="Optimization model"
                  eyebrow="Existing solver configuration"
                >
                  <DataList
                    rows={[
                      ["Solver", "OR-Tools GLOP"],
                      ["Horizon", "Single interval"],
                      ["Cost weight", "1.0"],
                      ["Carbon weight", "1.0"],
                      [
                        "Curtailment / degradation / profit",
                        "Default weights: 1.0",
                      ],
                    ]}
                  />
                  <div className="panel-divider" />
                  <h3>Modeled constraints</h3>
                  <ul className="constraint-list">
                    <li>Power balance / demand satisfaction</li>
                    <li>Renewable availability</li>
                    <li>Battery charge and discharge bounds</li>
                    <li>Battery SOC / capacity headroom</li>
                    <li>Grid export transmission bound</li>
                  </ul>
                  <p className="helper">
                    Configuration is read-only. Reserve requirements, asset
                    outages, import transmission limits, and market limits are
                    not enforced by the current solver. No cost/carbon impact
                    breakdown is returned.
                  </p>
                </Panel>
              </div>
              {orchestratorResult?.optimization && (
                <Panel title="Dispatch allocation" eyebrow="Solver output">
                  <Chart
                    option={barOption(
                      ["Solar", "Wind", "Import", "Export"],
                      [
                        orchestratorResult.optimization.solar_gen,
                        orchestratorResult.optimization.wind_gen,
                        orchestratorResult.optimization.grid_import,
                        orchestratorResult.optimization.grid_export,
                      ],
                    )}
                    label="Generation and grid allocation from the last optimization response"
                  />
                </Panel>
              )}
            </div>
          )}

          {activePage === "Decision History" && (
            <div className="page-stack">
              <ResourceFeedback {...history} />
              <Panel
                title="Decision timeline"
                eyebrow="Latest 10 scenario audit records"
                trailing={<Badge>{history.data?.length ?? "—"} records</Badge>}
              >
                {records(history.data)}
                <p className="helper">
                  Timestamps retain source wall time; the API does not specify a
                  timezone. Risk, confidence, approval status, and searchable
                  history are not implemented.
                </p>
              </Panel>
            </div>
          )}

          {activePage === "Analytics" && (
            <div className="page-stack">
              <ResourceFeedback {...analytics} />
              <div className="two-column">
                <Metric
                  label="Cost savings"
                  value={analytics.data?.cost_savings}
                  unit="$"
                  caption="Backend demo aggregate"
                  icon={<ChartBarIcon />}
                />
                <Metric
                  label="Carbon reduction"
                  value={analytics.data?.carbon_reduction_tons}
                  unit="tons"
                  caption="Backend demo aggregate"
                  tone="cyan"
                  icon={<CloudIcon />}
                />
              </div>
              <p className="notice">
                The analytics API returns fixed demo aggregates. No reporting
                period, baseline, or calculation provenance is supplied.
              </p>
              <div className="two-column">
                <Panel title="Demand trend" eyebrow="Available grid history">
                  <ResourceFeedback {...grid} />
                  {gridChart ? (
                    <Chart
                      option={gridChart}
                      label="Demand across the latest grid measurements"
                    />
                  ) : (
                    <Empty title="No demand history">
                      Grid records are unavailable.
                    </Empty>
                  )}
                </Panel>
                <Panel
                  title="Battery utilization context"
                  eyebrow="Current storage telemetry"
                >
                  <ResourceFeedback {...assets} />
                  {assets.data?.batteries.length ? (
                    <Chart
                      option={barOption(
                        assets.data.batteries.map((item) => item.name),
                        assets.data.batteries.map(
                          (item) => item.current_soc * 100,
                        ),
                        "% SOC",
                      )}
                      label="Current state of charge by battery"
                    />
                  ) : (
                    <Empty title="No storage telemetry">
                      Battery data is unavailable.
                    </Empty>
                  )}
                  <p className="helper">
                    SOC is a current snapshot, not historical utilization.
                    Reliability, cost time series, and renewable generation
                    trends are not supplied.
                  </p>
                </Panel>
              </div>
            </div>
          )}

          {activePage === "Alerts" && (
            <div className="two-column">
              <Panel title="Operational alerts" eyebrow="Monitoring coverage">
                <Empty title="Alert feed not implemented" icon={<BellIcon />}>
                  There is no alerts endpoint or resolution workflow in the
                  existing API. An empty feed does not indicate a healthy grid.
                </Empty>
                <div className="notice notice-warning">
                  Alert severity, timestamps, and acknowledgement are
                  unavailable.
                </div>
              </Panel>
              <Panel title="Environmental context" eyebrow="Weather API">
                <ResourceFeedback {...weather} />
                <DataList
                  rows={[
                    ["Reported conditions", weather.data?.status || "—"],
                    [
                      "Temperature",
                      `${number(weather.data?.temperature_c)} °C`,
                    ],
                    [
                      "Wind speed",
                      `${number(weather.data?.wind_speed_ms)} m/s`,
                    ],
                    ["Storm alerts", "Not supplied"],
                  ]}
                />
                <p className="helper">
                  Fixed backend demonstration data; not a live weather or
                  warning feed.
                </p>
              </Panel>
            </div>
          )}

          {activePage === "Settings" && (
            <div className="page-stack">
              <div className="two-column">
                <Panel
                  title="Connection & refresh"
                  eyebrow="Application configuration"
                >
                  <DataList
                    rows={[
                      ["API origin", "http://localhost:8000"],
                      ["System state endpoint", "/api/state"],
                      ["Refresh interval", "15 seconds"],
                      [
                        "Current connection",
                        stateError
                          ? "Unavailable / stale"
                          : state
                            ? "Connected"
                            : "Connecting",
                      ],
                    ]}
                  />
                  <p className="helper">
                    Existing connection settings are displayed read-only.
                    Configuration persistence is not implemented.
                  </p>
                </Panel>
                <Panel title="Workspace & presentation" eyebrow="Environment">
                  <DataList
                    rows={[
                      ["Workspace mode", "Simulation"],
                      ["Theme", "Energy command center / dark"],
                      ["Navigation", "12 existing page selections"],
                      ["Motion", "Follows system reduced-motion preference"],
                    ]}
                  />
                  <p className="helper">
                    All execution controls call the existing backend. This
                    workspace does not control a physical electricity grid.
                  </p>
                </Panel>
              </div>
              <Panel
                title="Settings availability"
                eyebrow="Configuration scope"
              >
                <Empty
                  title="No editable settings API"
                  icon={<Cog6ToothIcon />}
                >
                  No configuration form, save workflow, or persistence contract
                  exists in the original application. Connection and workspace
                  details are available above.
                </Empty>
              </Panel>
            </div>
          )}

          <footer className="content-footer">
            <span>
              <BoltIcon />
              Nexus Grid · Renewable Energy Orchestrator
            </span>
            <span>Simulation environment · API data as received</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default App;
