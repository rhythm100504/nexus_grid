# Implemented architecture

React / TypeScript dashboard -> same-origin /api proxy -> FastAPI -> SQLAlchemy simulation database.

Agent/scenario request -> persistent observed generation, demand, price, battery status and limits -> LangGraph -> OR-Tools -> constraint validation -> simulated impact estimate -> recommendation and solver-based explanation -> audit history.

LangGraph stages: analyze situation, check forecasts, check constraints, generate options, optimize, validate, simulate, decide and explain. Each invocation is operator-triggered; there is no background re-planning loop.

The numerical solver uses current asset capacities, generation factors, battery availability, efficiency and reserves, transmission limits, market price and saved objective weights. It solves a 15-minute interval. Enumerated modes prevent simultaneous grid import/export and simultaneous battery charge/discharge.

Scenario Simulator exposes ten working event controls and a reset control. Scenarios persist simulated changes; reset appends restored-state records without deleting history. Frontend polling runs every 15 real seconds; scenario timestamps advance by 15 simulated minutes.

Weather is simulated. Forecasts use current-state heuristics. Analytics estimates recommendation impacts against an all-grid baseline and does not measure realized savings. Alerts derive from storm status, battery outages, transmission constraints and infeasible results.

Local data uses SQLite; PostgreSQL is available in the Docker configuration. Redis, Kafka, physical telemetry and trained forecasting are not integrated into this runtime.
