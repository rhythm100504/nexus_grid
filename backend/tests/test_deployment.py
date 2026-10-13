"""Check deployment behavior without connecting to any hosted database."""
import os
from pathlib import Path
import subprocess
import sys

import pytest

BACKEND = Path(__file__).resolve().parents[1]

def run_import(code, url=None):
    env = {**os.environ, "VERCEL": "1", "GOOGLE_API_KEY": "",
           "CORS_ORIGINS": "https://frontend.example.com"}
    env.pop("DATABASE_URL", None)
    if url is not None:
        env["DATABASE_URL"] = url
    return subprocess.run([sys.executable, "-c", code], cwd=BACKEND,
                          env=env, capture_output=True, text=True, timeout=30)

@pytest.mark.parametrize("url, message", [
    (None, "Set DATABASE_URL"),
    ("sqlite:///demo.db", "SQLite files are not persistent"),
])
def test_vercel_rejects_missing_or_local_database(url, message):
    result = run_import("from app.api.main import app", url)
    assert result.returncode != 0
    assert message in result.stderr

@pytest.mark.parametrize("scheme", ["postgres", "postgresql", "postgresql+psycopg2"])
def test_hosted_configuration_and_cors_without_database_connection(scheme):
    result = run_import('''
from app.db.session import engine
from sqlalchemy.pool import NullPool
from app.api.main import app
from fastapi.testclient import TestClient
assert engine.url.drivername == "postgresql+psycopg2"
assert engine.url.query["sslmode"] == "require"
assert isinstance(engine.pool, NullPool)
with TestClient(app) as client:
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").json()["docs"] == "/docs"
    for origin, status in [("https://frontend.example.com", 200), ("https://other.example.com", 400)]:
        response = client.options("/api/state", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
        assert response.status_code == status
    assert "/api/orchestrator/run" in client.get("/openapi.json").json()["paths"]
''', f"{scheme}://test:test@example.invalid/demo?sslmode=require")
    assert result.returncode == 0, result.stderr
