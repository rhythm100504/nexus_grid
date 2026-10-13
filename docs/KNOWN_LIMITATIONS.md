# Current limits

- This is a simulation and recommendation system, not physical grid control. Solar/wind output is estimated from asset capacity and persistent scenario factors.
- Forecasts are current-state heuristics, not trained predictions or external weather data.
- Analytics sums estimated effects of independent 15-minute recommendations versus an all-grid baseline. Recommendations are not executed, so these are not realized savings or non-overlapping measurements.
- Battery SOC is displayed from asset records. A recommendation does not update SOC because it is not an executed dispatch.
- The optimizer uses a single interval and portfolio-wide battery charge/discharge modes. It is not a full electrical network or multi-interval planning model.
- There are no background execution, monitoring/re-planning nodes or risk-based action approvals. The action queue is empty; unknown approval/rejection IDs return 404.
- The localhost demonstration uses solver-based explanations without an LLM key. Provider-based explanations have not been verified in this task.
- Scenario changes accumulate. Reset simulation restores the first recorded starting conditions while preserving audit history and saved optimization preferences.
