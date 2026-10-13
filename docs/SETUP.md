# Run locally on macOS

Run these commands from the project folder. Python dependencies and frontend dependencies must be installed once.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt
cd frontend
npm ci
cd ..
```

Create the local simulation database and any missing tables. The generator does not reset existing data:

```sh
DATABASE_URL="sqlite:///$PWD/data/recording-demo.db" .venv/bin/python backend/scripts/generate_data.py
```

Terminal 1, from the project folder:

```sh
cd backend
GOOGLE_API_KEY='' DATABASE_URL="sqlite:///$PWD/../data/recording-demo.db" ../.venv/bin/python -m uvicorn app.api.main:app --host 127.0.0.1 --port 8000
```

Terminal 2, from the project folder:

```sh
cd frontend
npm run dev -- --host 127.0.0.1
```

Open http://localhost:5173. API documentation is at http://localhost:8000/docs. Vite forwards same-origin /api requests to the backend, avoiding browser hostname differences.

For another recording, use Reset simulation in Scenario Simulator. Reset preserves decision history and saved preferences. The app recommends actions; it does not execute them on real assets.

Docker Compose also supplies PostgreSQL, Redis and Kafka. Redis and Kafka are not connected to this demo's agent flow. The frontend Nginx configuration forwards /api to the backend service. Docker deployment was not validated during the macOS localhost tests.
