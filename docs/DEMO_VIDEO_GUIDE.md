# Nexus Grid: screen-sharing demonstration

Use the simple narration PDF in Downloads. Open http://localhost:5173 and refresh once after the backend has restarted.

1. Command Center: point to solar, wind, demand and price. These are API-connected simulation values.
2. Live Grid: show frequency, transmission capacity and recent demand history.
3. Renewable Assets: expand a farm's details.
4. Battery Management: show SOC and rated limits. Recommendations do not change stored SOC because no dispatch is executed.
5. Run Agentic Optimization: wait for the solver result. Show the returned explanation and optimization breakdown.
6. Scenario Simulator: click Reset simulation, then Demand Spike +25%. The result displays before/after demand and a recommendation using the increased demand. Return to Command Center and point to the changed value.
7. Test another scenario from a clean starting state using Reset simulation. All ten controls modify their corresponding simulated conditions; simultaneous events changes both solar and price.
8. Decision History: expand the newest record. Both standalone agent runs and scenario runs persist results. Reloading restores the latest recorded recommendation.
9. Forecasting: show the 1-hour heuristic outlook. Demand/renewable scenarios change these values. Forecast Deviation changes the outlook without changing current demand.
10. Analytics: describe the values as estimated simulated recommendation impacts versus an all-grid baseline, never as realized savings.
11. Alerts: run Battery B1 Failure or Storm Warning, then show the corresponding alert.
12. Settings: edit a cost/carbon weight or battery reserve, save, and run optimization again. Preferences persist in the simulation database.
13. Finish with Reset simulation so the next recording starts from the saved baseline. History remains available.

Repeated scenarios accumulate changes. Transmission limitations combined with a high load or storm may correctly return INFEASIBLE and review_required. This is an operational result, not a broken button. Reset restores starting conditions.

The demo has no external utility telemetry, trained forecasting, physical execution or automatic re-planning. Without an AI provider key, the explanation is generated directly from solver outputs.
