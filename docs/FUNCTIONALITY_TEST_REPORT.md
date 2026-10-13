# Functionality verification - October 9, 2026

The demo functionality was tested on macOS with the real React frontend, FastAPI backend, SQLite simulation database, LangGraph workflow and OR-Tools solver. Chrome requests were not mocked for the functionality checks. Separate fault-injection checks tested unavailable APIs, HTTP errors and stale data.

## Results

- Backend: 61 passing tests. Four expected failures identify future background execution/re-planning and risk-based approval metadata; those capabilities are not implemented or represented as working demo controls.
- Chrome: all 25 tests passed. Coverage includes every page at six widths (320-1920px), WCAG A/AA checks, real API values, optimization, all ten scenarios, polling, mobile navigation, failure states, chart tooltips, settings persistence, operational alerts, reset, duplicate-click prevention and automatic scrolling to scenario results.
- Frontend production build passed. The existing bundle-size warning remains.
- Final localhost recording smoke check: demand changed from 444.7578289 MW to 555.9472861 MW (exactly +25%), returned a feasible dispatch with 38.9930996 MW grid import and 100 MW battery discharge, and reset returned demand to 444.7578289 MW. No browser JavaScript errors were recorded.

## Changes

The agent preserves observed demand and price. All scenarios change the advertised simulated conditions and the dispatch uses current generation, battery status/limits, reserves, transmission and market inputs. Mode enumeration prohibits opposing grid and battery flows. Infeasible requests return a review-required recommendation rather than a false success.

Scenario results show before/after values. Resource refresh happens immediately after successful mutations. Execution buttons lock while a request is pending. Standalone agent runs and scenarios persist decision history; the latest decision returns after reload.

Weather/forecast events persist in the simulation configuration. Forecasts derive from current state. Analytics estimates impacts from recorded feasible recommendations against an all-grid baseline. Alerts reflect storms, outages, transmission constraints and infeasibility. Optimization settings save to the database and apply to future recommendations.

## Recording environment

Website: http://localhost:5173. Backend: http://localhost:8000/docs.

The active database is data/recording-demo.db. The previous data/local-demo.db was preserved: repeated demand injections had increased its latest demand to 98,748.8995 MW. A fresh recording database avoids that accumulated stress state.

Reset simulation restores the first recorded starting conditions, keeps audit records, and preserves saved optimization preferences. The final recording database was reset and is ready to demonstrate another +25% demand increase.

This remains a simulation recommendation system. It does not execute dispatch, connect external telemetry, train forecasts or demonstrate realized savings. Docker deployment and the optional LLM provider path were not verified.

## Evidence

- docs/evidence/final-localhost-smoke.json
- docs/evidence/fixed-demand-spike.png
- docs/evidence/recording-ready.png
- backend/tests/test_requirements.py
- frontend/tests/energy.spec.cjs
- frontend/tests/functionality.spec.cjs
