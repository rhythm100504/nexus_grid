# Architecture

Data Sources -> Kafka / Ingestion -> Data Validation -> Current State Store -> Forecasting + Risk + Constraints -> Agent Orchestrator (LangGraph) -> Specialist Agents -> Optimization Engine (OR-Tools) -> Constraint / Safety Validation -> Scenario Simulation -> Decision + Explanation -> Action Recommendation / Simulated Execution -> Monitoring -> Re-planning

## Technology Stack
- **Frontend**: React + TypeScript + Tailwind CSS + Apache ECharts
- **Backend**: Python + FastAPI + Pydantic + SQLAlchemy
- **Agent orchestration**: LangGraph
- **LLM**: Provider abstraction (OpenAI/Anthropic/Google Gemini)
- **Optimization**: Google OR-Tools
- **Forecasting**: XGBoost / LightGBM
- **Database**: PostgreSQL
- **State/cache**: Redis
- **Event streaming**: Apache Kafka
- **Simulation**: Python
- **Containers**: Docker + Docker Compose
