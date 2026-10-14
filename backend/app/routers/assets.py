from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.database import get_db
from backend.app.models.asset import Asset
from backend.app.models.work_order import WorkOrder
from backend.app.schemas.asset import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetDetailResponse,
    AssetMaintenanceHistoryItem
)
from backend.app.schemas.asset_health import (
    AssetHealthOverviewResponse,
    AssetHealthDetail
)
from backend.app.services.asset_service import (
    get_asset_maintenance_history,
    generate_asset_maintenance_history_csv
)
from backend.app.services.asset_health_service import (
    get_fleet_asset_health_overview,
    calculate_asset_health
)

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("/health", response_model=AssetHealthOverviewResponse)
def get_fleet_asset_health(
    category: Optional[str] = Query(None, description="Filter by machinery category"),
    status: Optional[str] = Query(None, description="Filter by asset status"),
    risk_level: Optional[str] = Query(None, description="Filter by risk category: LOW, MODERATE, HIGH, CRITICAL, INSUFFICIENT_DATA"),
    needs_attention: Optional[bool] = Query(None, description="Filter to assets requiring maintenance attention"),
    db: Session = Depends(get_db)
):
    """
    Fleet-wide rule-based Asset Health & Risk Monitoring overview.
    Read-only dynamic assessment based on documented operational logs, overdue tickets, and thresholds.
    """
    return get_fleet_asset_health_overview(
        db=db,
        category=category,
        status=status.upper() if status else None,
        risk_level=risk_level.upper() if risk_level else None,
        needs_attention_only=bool(needs_attention)
    )

@router.get("/{asset_id}/health", response_model=AssetHealthDetail)
def get_single_asset_health(
    asset_id: int,
    db: Session = Depends(get_db)
):
    """
    Detailed rule-based Asset Health & Risk breakdown for a single machinery profile.
    """
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    work_orders = (
        db.query(WorkOrder)
        .filter(WorkOrder.asset_id == asset_id)
        .order_by(WorkOrder.created_at.desc())
        .all()
    )
    return calculate_asset_health(asset, work_orders)

@router.get("", response_model=List[AssetResponse])
def list_assets(
    q: Optional[str] = Query(None, description="Search by name, tag, location, serial"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    page: Optional[int] = Query(None, ge=1, description="Page number for pagination"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Page size for pagination"),
    response: Response = None,
    db: Session = Depends(get_db)
):
    query = db.query(Asset)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Asset.name.ilike(term),
                Asset.asset_tag.ilike(term),
                Asset.location.ilike(term),
                Asset.serial_number.ilike(term)
            )
        )
    if status:
        query = query.filter(Asset.status == status.upper())
    if category:
        query = query.filter(Asset.category == category)
    query = query.order_by(Asset.name.asc())

    total_count = query.count()
    if response:
        response.headers["X-Total-Count"] = str(total_count)
        response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    if page is not None and page_size is not None:
        offset = (page - 1) * page_size
        return query.offset(offset).limit(page_size).all()

    return query.all()

@router.post("", response_model=AssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(payload: AssetCreate, db: Session = Depends(get_db)):
    existing = db.query(Asset).filter(Asset.asset_tag == payload.asset_tag.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Asset tag '{payload.asset_tag}' already exists."
        )
    
    asset = Asset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset

@router.get("/{asset_id}", response_model=AssetDetailResponse)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    
    total_wo = db.query(WorkOrder).filter(WorkOrder.asset_id == asset_id).count()
    active_wo = db.query(WorkOrder).filter(
        WorkOrder.asset_id == asset_id,
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS"])
    ).count()

    resp = AssetDetailResponse.model_validate(asset)
    resp.work_orders_count = total_wo
    resp.active_work_orders_count = active_wo
    return resp

@router.patch("/{asset_id}", response_model=AssetResponse)
@router.put("/{asset_id}", response_model=AssetResponse)
def update_asset(asset_id: int, payload: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if val is not None:
            setattr(asset, field, val)
            
    db.commit()
    db.refresh(asset)
    return asset

@router.get("/{asset_id}/maintenance-history", response_model=List[AssetMaintenanceHistoryItem])
def get_asset_maintenance_history_endpoint(
    asset_id: int,
    response: Response,
    page: Optional[int] = Query(None, ge=1, description="Page number (1-indexed)"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Page size limit"),
    limit: Optional[int] = Query(None, ge=1, description="Direct record limit"),
    offset: Optional[int] = Query(None, ge=0, description="Direct record offset"),
    status: Optional[str] = Query(None, description="Filter by status (OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED)"),
    priority: Optional[str] = Query(None, description="Filter by priority (LOW, MEDIUM, HIGH, CRITICAL)"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    db: Session = Depends(get_db)
):
    records, total_count = get_asset_maintenance_history(
        db=db,
        asset_id=asset_id,
        page=page,
        page_size=page_size,
        limit=limit,
        offset=offset,
        status=status,
        priority=priority,
        start_date=start_date,
        end_date=end_date
    )
    response.headers["X-Total-Count"] = str(total_count)
    return records


@router.get("/{asset_id}/maintenance-history/export")
def export_asset_maintenance_history_endpoint(
    asset_id: int,
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    db: Session = Depends(get_db)
):
    """Exports complete maintenance history for an asset to CSV."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {asset_id} does not exist."
        )

    records, _ = get_asset_maintenance_history(
        db=db,
        asset_id=asset_id,
        status=status,
        priority=priority,
        start_date=start_date,
        end_date=end_date
    )
    csv_data = generate_asset_maintenance_history_csv(asset, records)
    filename = f"maintainiq_asset_{asset.asset_tag}_history_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
