from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.database import engine, Base
from backend.app.routers import (
    assets_router,
    technicians_router,
    maintenance_types_router,
    work_orders_router,
    dashboard_router
)
from backend.app.seed import seed_database

# Initialize database schema
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
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

@app.post("/api/seed", tags=["System"])
def trigger_seed():
    seed_database()
    return {"message": "Database successfully populated with realistic maintenance assets and work orders."}

@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "MaintainIQ API", "version": settings.PROJECT_VERSION}
