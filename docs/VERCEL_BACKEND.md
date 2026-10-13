# Deploy the backend to Vercel

The backend uses Vercel's native FastAPI support. Configuration follows
[Vercel's FastAPI documentation](https://vercel.com/docs/frameworks/backend/fastapi).

1. Push the deployment changes to your connected Git repository.
2. Import the repository as a separate backend project in Vercel. Set **Root Directory** to `backend` and **Framework Preset** to **FastAPI**. Leave Install Command, Build Command and Output Directory at their defaults. Python 3.12 and the application entrypoint are configured in the repository. No Docker build or Uvicorn start command is needed.
3. Create a hosted PostgreSQL database (for example, through Vercel Marketplace). Set `DATABASE_URL` in the backend project's Production and Preview environments to the provider's pooled PostgreSQL URL with SSL enabled. Use an isolated database for previews if you don't want preview scenarios changing production data.
4. Set `CORS_ORIGINS` to the frontend's exact HTTPS origin, without a trailing slash. Multiple origins can be comma-separated. `GOOGLE_API_KEY` is optional; leave it unset for solver-based explanations.
5. Initialize the hosted database once from your local machine before using the API:

   ```sh
   # From the repository root. Supply the hosted URL privately in your shell.
   read -s 'DATABASE_URL?Hosted PostgreSQL URL: '
   export DATABASE_URL
   .venv/bin/python backend/scripts/generate_data.py
   unset DATABASE_URL
   ```

   The generator creates missing tables and seeds an empty database without resetting existing data. It is not a migration tool: `create_all` does not alter existing columns, and market sample rows are inserted only when the grid table is empty. Review partially populated databases before seeding. Database initialization is intentionally separate from deployment and concurrent function startup.

6. Deploy and check `https://YOUR-BACKEND.vercel.app/health`, `/docs`, `/api/assets` and `/api/state`. The health endpoint checks that the application runs; the asset/state endpoints also check database connectivity and initialization.

The frontend currently calls same-origin `/api` URLs. Configure its hosting proxy/rewrite to forward `/api/:path*` to `https://YOUR-BACKEND.vercel.app/api/:path*`. CORS alone does not redirect those requests. Local Vite and Docker Nginx already have their own API proxies.

SQLite and local PostgreSQL URLs are for local development only. Vercel instances cannot share a persistent local database. The deployment fails early if `DATABASE_URL` is absent or points to SQLite.

Runtime dependencies are in `backend/requirements.txt`. Install `backend/requirements-dev.txt` to run tests, or `backend/requirements-optional.txt` for the unused XGBoost forecasting stub and infrastructure experiments. Keeping these extras out of the deployed runtime reduces bundle size.


## Review and push changes later

There are pre-existing local backend and frontend modifications. The backend routes depend on the new `app/api/simulation.py` and `SimulationConfig` model, so pushing only the Vercel configuration would omit the current application behavior. Review the complete backend diff before staging it. These commands include the current backend work and the existing local/Docker API proxy configuration; they do not stage screenshots or unrelated UI changes.

```sh
cd /Users/rhythm/Downloads/Rhythm_Accenture
git status --short
git diff -- backend README.md docs/SETUP.md frontend/Dockerfile frontend/vite.config.ts
git check-ignore backend/.env
git add backend README.md docs/SETUP.md docs/VERCEL_BACKEND.md frontend/Dockerfile frontend/vite.config.ts frontend/nginx.conf
git diff --cached --check
git diff --cached --name-only
git diff --cached
# Review the staged content before the next two commands.
git commit -m "Prepare FastAPI backend for native Vercel deployment"
git push origin main
```

`git check-ignore` should print `backend/.env`. Actual `.env` files must not appear in the staged file list. The tracked `.env.example` contains placeholders only. Nothing has been committed or pushed by this task.

## Frontend on Vercel

The backend project uses Root Directory `backend`. A separate frontend project would use Root Directory `frontend`, Framework Preset `Vite`, Build Command `npm run build`, and Output Directory `dist`.

Once the real backend hostname is known, add `frontend/vercel.json` with the following configuration, replacing `YOUR-BACKEND` first. This is an example, not an active placeholder rewrite in the repository.

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-BACKEND.vercel.app/api/:path*"
    },
    {
      "source": "/((?!api(?:/|$)).*)",
      "destination": "/index.html"
    }
  ]
}
```

The API rewrite forwards GET, POST and PUT requests while retaining the `/api` prefix. The second rule supports browser navigation to frontend pages without swallowing API requests. Vite's development proxy is not part of a static production build. A rewrite lets the existing Axios calls keep using `/api`; no public database credentials or Gemini keys belong in frontend environment variables. CORS controls cross-origin browser access; it does not act as authentication.

## Database preparation after you choose a provider

No hosted database was created, connected to, or initialized during this task. First create a separate development/preview PostgreSQL database when you decide to proceed. Use the provider's recommended pooled URL for runtime requests and its recommended direct URL for schema initialization if it supplies separate URLs. Preserve provider SSL parameters. Keep preview and production databases separate.

Use the hidden-input command above only with that development/preview database. Inspect its tables and sample data after initialization, then set the backend's Preview environment variable to the runtime URL. Prepare a production database only as a separate, deliberate step after preview verification; there is no automatic initialization in a build or startup hook.

## Verify a deployment after you decide to deploy

1. Open `/`: it should identify the API and link to docs/health.
2. Open `/health`: expect `{"status":"ok"}`. This endpoint does not check PostgreSQL.
3. Open `/docs` and `/openapi.json`: confirm the routes are listed.
4. Open `/api/assets`: expect seeded solar farms, wind farms and batteries.
5. Open `/api/state`, `/api/forecasts` and `/api/settings`: expect database-backed simulation responses.
6. In the preview environment only, POST `/api/orchestrator/run` from `/docs`, then inspect `/api/decisions`. This writes an audit record and checks LangGraph plus OR-Tools together.
7. Through the frontend, check that `/api/state` reaches the backend rather than returning HTML. In preview, check scenario execution, settings updates and reset. These operations change simulation data.
8. If requests return 500, inspect backend Function logs for missing environment variables, database connectivity, missing tables or dependency errors. Do not paste connection strings or keys into public logs/issues. If a frontend rewrite is blocked by deployment protection, configure access for the intended frontend; a proxy cannot bypass that protection.

## Reproduce local checks

```sh
# From repository root, with Python 3.12 installed:
python3.12 -m venv /tmp/nexus-vercel-check
/tmp/nexus-vercel-check/bin/python -m pip install -r backend/requirements-dev.txt
cd backend
GOOGLE_API_KEY='' DATABASE_URL='sqlite://' /tmp/nexus-vercel-check/bin/python -m pytest tests -q
cd ../frontend
npm run build
```

The API regression tests override the database dependency with temporary SQLite data. Deployment tests use non-routable dummy PostgreSQL URLs and never open database connections. A real Linux Vercel build and live PostgreSQL checks remain necessary after deployment.

## Docker Compose

Compose continues to pass its internal PostgreSQL URL and local `.env` configuration to the backend. The backend Dockerfile continues to launch `app.api.main:app` with Uvicorn; it is separate from Vercel's Python runtime. The frontend Nginx proxy continues forwarding `/api/` to `backend:8000`. Local environment files are excluded from the backend Docker build context.

For a fresh local Docker setup, copy `backend/.env.example` to `backend/.env` only if you do not already have a local `.env`; leave the optional Gemini key empty for the solver fallback. Compose overrides `DATABASE_URL` with its internal local database URL. After `docker compose up --build -d`, initialize **only the local Compose database** with `docker compose exec backend python scripts/generate_data.py`. No Docker commands were run here because Docker is unavailable.


## Actual validation results

Validated locally with a fresh Python **3.12.10** environment:

- `pytest tests -q`: **66 passed, 4 xfailed**, 3 SWIG deprecation warnings. Expected failures concern existing execution/monitoring/replanning and approval-metadata gaps.
- `pip check`: **No broken requirements found**.
- `npm run build`: **passed** (TypeScript and Vite). Vite reported an existing JavaScript chunk size warning.
- PostgreSQL DDL compilation: **all model tables passed**; this is not a live PostgreSQL integration test.
- Seed generator: **passed twice against one temporary SQLite database**, retaining 5 solar farms, 3 wind farms, 2 batteries, 96 grid rows and 96 market rows.
- Entrypoint, Python version, JSON configuration, secret exclusions and `git diff --check`: **passed**.

No Docker runtime, Linux Vercel build, real PostgreSQL connection, Gemini API call or deployed frontend/backend integration was tested. Dependencies remain unpinned, so future dependency resolution can differ from this test run. No commit, push, deployment or hosted database initialization was performed.
