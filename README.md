# nexus_grid

Nexus Grid is a renewable-energy orchestration prototype built for the Accenture utilities challenge. It combines a React dashboard, a FastAPI backend, a LangGraph agent workflow and OR-Tools dispatch optimization.

Explore solar and wind assets, battery information, simulated grid demand and market prices, optimization recommendations, and scenario decision history.

This is a simulation prototype. Generation estimates, sample forecasts and analytics are not real utility measurements. Some agent workflow stages are placeholders, and the no-key fallback currently discards observed demand and price. Recommendations do not control physical assets.

- [Setup](docs/SETUP.md)
- [API](docs/API.md)
- [Demo and implementation limitations](docs/DEMO_VIDEO_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)

Local environment files, dependencies, generated builds and databases are excluded from version control.
