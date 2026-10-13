from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import api_router
import os

allowed_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]

app = FastAPI(title="Renewable Energy Orchestrator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials="*" not in allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.get("/")
def root():
    return {"service": "Nexus Grid API", "docs": "/docs", "health": "/health"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
