from backend.app.routers.assets import router as assets_router
from backend.app.routers.technicians import router as technicians_router
from backend.app.routers.maintenance_types import router as maintenance_types_router
from backend.app.routers.work_orders import router as work_orders_router
from backend.app.routers.dashboard import router as dashboard_router
from backend.app.routers.checklists import router as checklists_router

__all__ = [
    "assets_router",
    "technicians_router",
    "maintenance_types_router",
    "work_orders_router",
    "dashboard_router",
    "checklists_router"
]

