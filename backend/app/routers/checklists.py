from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.database import get_db
from backend.app.models.checklist import (
    ChecklistTemplate,
    ChecklistTemplateItem,
    WorkOrderChecklist,
    WorkOrderChecklistItem
)
from backend.app.schemas.checklist import (
    ChecklistTemplateCreate,
    ChecklistTemplateResponse,
    WorkOrderChecklistResponse,
    WorkOrderChecklistInitialize,
    WorkOrderChecklistItemUpdate,
    WorkOrderChecklistItemResponse,
    WorkOrderChecklistComplete
)
from backend.app.services.checklist_service import (
    build_checklist_response,
    initialize_work_order_checklist,
    update_checklist_item_response,
    save_checklist_evidence_attachment,
    get_checklist_attachment_path,
    remove_checklist_evidence_attachment,
    complete_work_order_checklist
)

router = APIRouter(tags=["Checklists"])


# ==========================================
# Template Management Endpoints
# ==========================================

@router.get("/checklists/templates", response_model=List[ChecklistTemplateResponse])
def list_checklist_templates(
    asset_category: Optional[str] = Query(None, description="Filter by asset category"),
    maintenance_type_id: Optional[int] = Query(None, description="Filter by maintenance type ID"),
    db: Session = Depends(get_db)
):
    """Lists active digital inspection checklist templates with optional filtering."""
    query = db.query(ChecklistTemplate).filter(ChecklistTemplate.is_active == True)
    if asset_category:
        query = query.filter(ChecklistTemplate.asset_category.ilike(f"%{asset_category.strip()}%"))
    if maintenance_type_id:
        query = query.filter(ChecklistTemplate.maintenance_type_id == maintenance_type_id)
    return query.order_by(ChecklistTemplate.title.asc()).all()


@router.get("/checklists/templates/{template_id}", response_model=ChecklistTemplateResponse)
def get_checklist_template(template_id: int, db: Session = Depends(get_db)):
    """Fetches a single inspection template with its ordered items."""
    tmpl = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == template_id).first()
    if not tmpl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Checklist template {template_id} not found.")
    return tmpl


@router.post("/checklists/templates", response_model=ChecklistTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_checklist_template(payload: ChecklistTemplateCreate, db: Session = Depends(get_db)):
    """Creates a new reusable inspection checklist template with structured items."""
    tmpl = ChecklistTemplate(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        asset_category=payload.asset_category.strip() if payload.asset_category else None,
        maintenance_type_id=payload.maintenance_type_id,
        is_active=True
    )
    db.add(tmpl)
    db.flush()

    for idx, it in enumerate(payload.items, start=1):
        item = ChecklistTemplateItem(
            template_id=tmpl.id,
            order_index=it.order_index or idx,
            item_text=it.item_text.strip(),
            description=it.description.strip() if it.description else None,
            is_required=it.is_required
        )
        db.add(item)

    db.commit()
    db.refresh(tmpl)
    return tmpl


# ==========================================
# Work Order Checklist Endpoints
# ==========================================

@router.get("/work-orders/{wo_id}/checklist", response_model=Optional[WorkOrderChecklistResponse])
def get_work_order_checklist(wo_id: int, db: Session = Depends(get_db)):
    """Returns the digital inspection checklist for a work order, or 404 if not yet initialized."""
    checklist = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo_id).first()
    if not checklist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inspection checklist not yet initialized for work order {wo_id}."
        )
    return build_checklist_response(checklist)


@router.post("/work-orders/{wo_id}/checklist", response_model=WorkOrderChecklistResponse, status_code=status.HTTP_201_CREATED)
def initialize_checklist(
    wo_id: int,
    payload: Optional[WorkOrderChecklistInitialize] = None,
    db: Session = Depends(get_db)
):
    """
    Initializes a digital inspection checklist for a work order.
    Snapshots template items so future template edits will not affect this inspection history.
    """
    template_id = payload.template_id if payload else None
    title = payload.title if payload else None
    checklist = initialize_work_order_checklist(db, wo_id=wo_id, template_id=template_id, custom_title=title)
    return build_checklist_response(checklist)


@router.put("/work-orders/{wo_id}/checklist/items/{item_id}", response_model=WorkOrderChecklistItemResponse)
def update_checklist_item(
    wo_id: int,
    item_id: int,
    payload: WorkOrderChecklistItemUpdate,
    db: Session = Depends(get_db)
):
    """Updates a checklist item response: marks PASS, FAIL, or NOT_APPLICABLE with notes and inspector name."""
    item = update_checklist_item_response(
        db,
        wo_id=wo_id,
        item_id=item_id,
        status_val=payload.status.value if payload.status else None,
        notes=payload.notes,
        inspected_by=payload.inspected_by
    )
    return WorkOrderChecklistItemResponse(
        id=item.id,
        checklist_id=item.checklist_id,
        order_index=item.order_index,
        item_text=item.item_text,
        description=item.description,
        is_required=item.is_required,
        status=item.status,
        notes=item.notes,
        inspected_at=item.inspected_at,
        inspected_by=item.inspected_by,
        attachment_filename=item.attachment_filename,
        attachment_content_type=item.attachment_content_type,
        attachment_file_size=item.attachment_file_size,
        has_attachment=bool(item.attachment_path)
    )


@router.post("/work-orders/{wo_id}/checklist/items/{item_id}/attachment", response_model=WorkOrderChecklistItemResponse)
async def upload_evidence_attachment(
    wo_id: int,
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads an optional evidence file (photo, PDF, test log) for an inspection item.
    Enforces maximum size (5 MB), allowed extension and MIME validation, and secure filename generation.
    """
    item = await save_checklist_evidence_attachment(db, wo_id=wo_id, item_id=item_id, file=file)
    return WorkOrderChecklistItemResponse(
        id=item.id,
        checklist_id=item.checklist_id,
        order_index=item.order_index,
        item_text=item.item_text,
        description=item.description,
        is_required=item.is_required,
        status=item.status,
        notes=item.notes,
        inspected_at=item.inspected_at,
        inspected_by=item.inspected_by,
        attachment_filename=item.attachment_filename,
        attachment_content_type=item.attachment_content_type,
        attachment_file_size=item.attachment_file_size,
        has_attachment=bool(item.attachment_path)
    )


@router.get("/work-orders/{wo_id}/checklist/items/{item_id}/attachment")
def download_evidence_attachment(
    wo_id: int,
    item_id: int,
    db: Session = Depends(get_db)
):
    """Downloads or views an inspection evidence attachment with directory traversal protection."""
    file_path, filename, content_type = get_checklist_attachment_path(db, wo_id=wo_id, item_id=item_id)
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=content_type
    )


@router.delete("/work-orders/{wo_id}/checklist/items/{item_id}/attachment", response_model=WorkOrderChecklistItemResponse)
def delete_evidence_attachment(
    wo_id: int,
    item_id: int,
    db: Session = Depends(get_db)
):
    """Removes an uploaded evidence attachment safely from disk and database."""
    item = remove_checklist_evidence_attachment(db, wo_id=wo_id, item_id=item_id)
    return WorkOrderChecklistItemResponse(
        id=item.id,
        checklist_id=item.checklist_id,
        order_index=item.order_index,
        item_text=item.item_text,
        description=item.description,
        is_required=item.is_required,
        status=item.status,
        notes=item.notes,
        inspected_at=item.inspected_at,
        inspected_by=item.inspected_by,
        attachment_filename=None,
        attachment_content_type=None,
        attachment_file_size=None,
        has_attachment=False
    )


@router.post("/work-orders/{wo_id}/checklist/complete", response_model=WorkOrderChecklistResponse)
def complete_checklist(
    wo_id: int,
    payload: Optional[WorkOrderChecklistComplete] = None,
    db: Session = Depends(get_db)
):
    """
    Finalizes and marks the inspection checklist as completed.
    Validates that all required items have been inspected (non-PENDING).
    """
    summary_notes = payload.summary_notes if payload else None
    completed_by = payload.completed_by if payload else None
    checklist = complete_work_order_checklist(
        db,
        wo_id=wo_id,
        summary_notes=summary_notes,
        completed_by=completed_by
    )
    return build_checklist_response(checklist)
