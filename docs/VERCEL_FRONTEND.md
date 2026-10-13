# Deploy the frontend to Vercel

The frontend is configured to forward `/api` requests to the deployed backend at
`https://nexus-grid-ivory.vercel.app`. The rewrite preserves the `/api` prefix,
request methods and query strings. Existing Axios calls need no changes.

## Review and push

The working tree contains existing frontend changes. Review these before including
them; the following commands publish the current frontend source plus deployment
configuration, without staging unrelated screenshots or documentation changes.

```sh
cd /Users/rhythm/Downloads/Rhythm_Accenture
git diff -- frontend/src
git add frontend/src frontend/vercel.json frontend/.vercelignore docs/VERCEL_FRONTEND.md
git diff --cached --check
git diff --cached --name-only
git diff --cached
git commit -m "Configure Vercel frontend with deployed FastAPI backend"
git push origin main
```

## Vercel settings

1. Add a **new project** in Vercel and import `rhythm100504/nexus_grid`. Keep the backend project separate.
2. Set **Root Directory** to `frontend`.
3. Use **Framework Preset: Vite**, **Install Command: npm ci**, **Build Command: npm run build**, and **Output Directory: dist**. These commands are also configured in `frontend/vercel.json`.
4. No frontend environment variables are required. Database credentials and Gemini keys stay in the backend project.
5. Deploy after the configuration is pushed.

The existing Vite localhost proxy and Docker Nginx proxy continue to support local
development. Vercel uses `frontend/vercel.json` for its production proxy and SPA
fallback.

## Verify after deployment

1. Open the frontend URL and confirm the dashboard loads.
2. Open `https://YOUR-FRONTEND.vercel.app/api/state`: expect JSON, not the frontend HTML.
3. Compare that response with `https://nexus-grid-ivory.vercel.app/api/state`.
4. Check `/api/assets`, `/api/forecasts` and `/api/settings` through the frontend URL.
5. Use the browser Network panel to confirm API calls return successful JSON responses.
6. Only against an intended test database, check optimization, scenarios and settings updates; these operations write simulation data.

CORS is not needed for the browser's same-origin `/api` requests. If you also call
the backend directly from the browser, add the exact frontend HTTPS origin to the
backend's `CORS_ORIGINS` and redeploy the backend. CORS does not redirect requests
or replace database configuration.

If the backend returns 500, inspect its Vercel Function logs and hosted database
configuration. If it returns a Vercel sign-in page or 401, check Deployment
Protection: the frontend rewrite needs access to the backend deployment.

This task configures files locally; it does not create a Vercel project, commit,
push, deploy, or change hosted database data.

## Validation on October 14, 2026

- `npm run build`: passed (TypeScript and Vite), with a chunk-size warning.
- Vercel JSON configuration, rewrite target and API exclusion from SPA fallback: passed.
- `git diff --check`: passed.
- Backend `/health`: returned `{"status":"ok"}`.
- Backend `/api/state`: returned HTTP 500. The cause needs investigation in backend Function logs; health alone does not confirm database connectivity or initialization.
