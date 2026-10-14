from typing import Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.config import settings
from backend.app.database import engine, Base, get_db
from backend.app.routers import (
    assets_router,
    technicians_router,
    maintenance_types_router,
    work_orders_router,
    dashboard_router,
    checklists_router
)
from backend.app.seed import seed_database

# Initialize database schema
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only run initial seeding on startup in development/test if table is empty
    if settings.ENVIRONMENT not in ("production", "prod"):
        try:
            seed_database()
        except Exception as e:
            print(f"Startup seeder notice: {e}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="MaintainIQ Maintenance Work Order Management System REST API",
    docs_url="/docs",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Enable CORS for frontend Vite dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(work_orders_router, prefix="/api")
app.include_router(assets_router, prefix="/api")
app.include_router(technicians_router, prefix="/api")
app.include_router(maintenance_types_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(checklists_router, prefix="/api")

@app.post("/api/seed", tags=["System"])
def trigger_seed(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    authorization: Optional[str] = Header(None)
):
    """
    Seed demo assets, technicians, and maintenance records.
    Restricted in production environments to prevent unauthorized database resets.
    """
    is_prod = settings.ENVIRONMENT in ("production", "prod")
    if is_prod or not settings.ALLOW_SEEDING:
        provided_key = x_admin_key or (
            authorization.replace("Bearer ", "") if authorization and authorization.startswith("Bearer ") else authorization
        )
        if not settings.ADMIN_API_KEY or provided_key != settings.ADMIN_API_KEY:
            raise HTTPException(
                status_code=403,
                detail="Database reseeding is restricted and disabled in production to protect existing data."
            )
    seed_database()
    return {"message": "Database successfully populated with realistic maintenance assets and work orders."}

@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
def health_check(db: Session = Depends(get_db)):
    db_connected = False
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False

    return {
        "status": "ok" if db_connected else "degraded",
        "service": "MaintainIQ API",
        "version": settings.PROJECT_VERSION,
        "database": "connected" if db_connected else "disconnected"
    }
