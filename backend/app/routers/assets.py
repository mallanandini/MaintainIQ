from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from backend.app.database import get_db
from backend.app.models.asset import Asset
from backend.app.models.work_order import WorkOrder
from backend.app.schemas.asset import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    AssetDetailResponse
)

router = APIRouter(prefix="/assets", tags=["Assets"])

@router.get("", response_model=List[AssetResponse])
def list_assets(
    q: Optional[str] = Query(None, description="Search by name, tag, location, serial"),
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
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
    return query.order_by(Asset.name.asc()).all()

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
