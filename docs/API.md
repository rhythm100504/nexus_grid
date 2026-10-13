# API Surface

GET /health
GET /api/state
GET /api/assets
GET /api/solar
GET /api/wind
GET /api/batteries
GET /api/grid
GET /api/market
GET /api/weather
GET /api/forecasts
POST /api/orchestrator/run
POST /api/scenarios/run
GET /api/scenarios
GET /api/decisions
GET /api/decisions/{id}
GET /api/actions
POST /api/actions/{id}/approve
POST /api/actions/{id}/reject
GET /api/analytics
GET /api/audit

POST /api/simulation/reset
GET /api/alerts
GET /api/settings
PUT /api/settings

Scenario IDs 1-10 update persistent simulation conditions. Invalid IDs return 422; an uninitialized scenario database returns 409. Responses include before/after state and a dispatch recommendation. Infeasible dispatch is explicitly reported as status=infeasible and decision.action=review_required.

Settings payload: cost_weight (0-100), carbon_weight (0-100), battery_reserve_percent (0-100). All fields are required. Preferences apply to the next recommendation.

Standalone agent and scenario runs persist audit records. Unknown decisions and approval/rejection IDs return 404. There are no executable actions in this recommendation prototype.
