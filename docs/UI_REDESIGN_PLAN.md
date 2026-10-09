# Frontend inspection and redesign plan

## Sources inspected before implementation

All project source files, frontend configuration, both backend tests, data generator, Docker Compose, and all ten existing documentation files were reviewed. The frontend consists of `App.tsx`, `main.tsx`, and Tailwind directives in `index.css`. Navigation is local React state, not URL routing. Axios directly calls localhost:8000. ECharts supplies one bar chart. There are no frontend tests, shared components, hooks, or API abstraction.

## Existing behavioral contracts

- State GET on mount and every 15 seconds; timer cleanup on unmount.
- Orchestrator POST without a request body; its response sets the current decision. Existing loading disables its button.
- Nine scenario buttons POST with `scenario_id` query parameter; store response and refresh state.
- Twelve page selections; current decision survives page selection within the session.
- Asset Details buttons have no handler; there are no implemented frontend approvals, settings persistence, filters, sliders, modals, or forecast horizon controls.

## Baseline findings

Command Center has four API-driven KPIs and a chart. Scenario Simulator has nine backend-connected buttons. Live Grid, Renewable Assets, Battery Management, and AI Decisions display hardcoded demonstration values. Six other pages contain a placeholder claiming database synchronization without an API call. Backend endpoints exist for assets, grid, market, weather, forecasts, decisions, actions, analytics and audit; there is no alerts or settings endpoint. API responses for weather, forecasts, analytics, and approval/rejection are stubs. No frontend business logic will be added to compensate.

Initial build cannot run: frontend dependencies are absent (`tsc: command not found`). Initial pytest cannot run: pytest is absent. No backend responds on port 8000; Docker is unavailable. Install dependencies in isolated environments and establish executable baseline before presentation edits. Original files saved in `/private/tmp/energy-baseline`.

## Visual audit

Fixed 288px sidebar and large padding leave mobile unusable. Grid status is always green even when requests fail. Dark chart axes are unreadable. Missing empty/error states, fake confidence, inactive Details controls, oversized gradients and repeated styling reduce clarity. No reduced-motion support, mobile navigation, or keyboard focus design.

## Design system and sequence

1. Record baseline build, backend tests, browser behavior and source hashes.
2. Introduce navy surfaces, emerald accent, cyan/amber/red semantic colors, compact typography, spacing, radii, focus and reduced-motion tokens.
3. Modernize the existing shell: grouped icon navigation, responsive drawer, simulation label, API connection indicator, compact page masthead.
4. Command Center: actual KPIs, energy mix chart, actual-state flow diagram, existing orchestration control and decision output.
5. Apply consistent panels, read-only API-backed presentation and honest unavailable states to all twelve pages. Preserve the original POST handlers and nine scenarios. Scenario ten has backend code but no existing frontend control; document the missing feature rather than introducing execution functionality.
6. Theme and resize ECharts; add explicit API error, stale data, empty and loading feedback. Never invent forecasts, histories, confidence, risk or health.
7. Run identical baseline/regression workflows. Use isolated seeded test data with the real FastAPI, LangGraph and OR-Tools implementations; do not mutate the user's operational database.
8. Requirement tests explicitly expose backend defects without fixing them. Record evidence, coverage, limitations, files changed and demo readiness.

## Boundaries

Backend source, schemas, optimization, forecasts and orchestration are untouched. New read-only frontend presentation can consume existing GET endpoints. No new approval workflow, configuration persistence, simulated controls or scenario ten control. Existing hardcoded presentation is replaced by actual API fields or clearly explained unavailable states under the user's prohibition on fabricated data.
