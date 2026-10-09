# Known Limitations

1. **Simulation Fidelity**: The current simulation uses a mock interval and doesn't fully capture battery non-linear degradation.
2. **LLM Explanations**: Agent explanations are currently templated based on OR-Tools outputs. Full generative explanations require deeper API integration.
3. **Forecasting**: Forecasting models are stubbed out and do not use live LightGBM/XGBoost inferences yet.
