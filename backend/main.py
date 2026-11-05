"""
Main FastAPI Application Entry Point for BrandGuard (Team Nexus — CodeNexus India 2026).
Initializes the SQLite database, seeds the ABC SmartFlow Brand Kit v3 and demo submissions,
mounts all governance API routers, and serves the Single-Page Web Application.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.routers import auth_routes, brand_kit, insights, submissions
from backend.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize SQLite schema and seed demo data on startup."""
    init_db()
    seed_if_empty()
    yield


app = FastAPI(
    title="BrandGuard — Intelligent Brand Governance Platform",
    description=(
        "Pre-publication content governance platform with hybrid deterministic + AI checks, "
        "evidence validation, intent-preserving fixes, confidential redaction, and role-based escalation."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_routes.router)
app.include_router(brand_kit.router)
app.include_router(submissions.router)
app.include_router(insights.router)


@app.get("/api/health")
def health_check():
    """Health check endpoint for cloud deployment and automated testing."""
    return {
        "status": "healthy",
        "product": "BrandGuard",
        "team": "Nexus (SRM Easwari Engineering College)",
        "round": "Round 2 — The Build (CodeNexus India 2026)",
        "version": "2.0.0",
    }


FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend"
)

if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.middleware("http")
async def disable_static_cache(request, call_next):
    """Ensure browser refreshes always pick up the latest SPA HTML, CSS, and JS."""
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.get("/")
def serve_spa_index():
    """Serve the BrandGuard Single-Page Application."""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    return FileResponse(
        index_path,
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )
