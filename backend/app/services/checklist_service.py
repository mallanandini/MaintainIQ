import os
import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.models.checklist import (
    ChecklistTemplate,
    ChecklistTemplateItem,
    WorkOrderChecklist,
    WorkOrderChecklistItem
)
from backend.app.models.work_order import WorkOrder
from backend.app.models.asset import Asset
from backend.app.schemas.checklist import (
    WorkOrderChecklistResponse,
    WorkOrderChecklistItemResponse
)

# Upload Storage Configuration
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "checklist_evidence"))
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB Limit

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt"}
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain"
}


def ensure_upload_dir():
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """Removes path components and dangerous characters from user-supplied filename."""
    base = os.path.basename(filename)
    clean = re.sub(r'[^a-zA-Z0-9_.-]', '_', base)
    return clean[:100]


def build_checklist_response(checklist: WorkOrderChecklist) -> WorkOrderChecklistResponse:
    """Computes summary statistics and formats the checklist response."""
    items = checklist.items or []
    total = len(items)
    passed = sum(1 for i in items if i.status == "PASS")
    failed = sum(1 for i in items if i.status == "FAIL")
    na = sum(1 for i in items if i.status == "NOT_APPLICABLE")
    pending = sum(1 for i in items if i.status == "PENDING")
    
    inspected = passed + failed + na
    completion_pct = round((inspected / total * 100.0), 1) if total > 0 else 0.0

    incomplete_required = sum(1 for i in items if i.is_required and i.status == "PENDING")
    can_complete = (incomplete_required == 0) and total > 0

    item_responses = []
    for it in items:
        item_responses.append(
            WorkOrderChecklistItemResponse(
                id=it.id,
                checklist_id=it.checklist_id,
                order_index=it.order_index,
                item_text=it.item_text,
                description=it.description,
                is_required=it.is_required,
                status=it.status,
                notes=it.notes,
                inspected_at=it.inspected_at,
                inspected_by=it.inspected_by,
                attachment_filename=it.attachment_filename,
                attachment_content_type=it.attachment_content_type,
                attachment_file_size=it.attachment_file_size,
                has_attachment=bool(it.attachment_path)
            )
        )

    return WorkOrderChecklistResponse(
        id=checklist.id,
        work_order_id=checklist.work_order_id,
        template_id=checklist.template_id,
        title=checklist.title,
        summary_notes=checklist.summary_notes,
        completed_at=checklist.completed_at,
        completed_by=checklist.completed_by,
        created_at=checklist.created_at,
        updated_at=checklist.updated_at,
        total_items=total,
        passed_items=passed,
        failed_items=failed,
        na_items=na,
        pending_items=pending,
        completion_percentage=completion_pct,
        has_failed_items=(failed > 0),
        can_complete=can_complete,
        incomplete_required_count=incomplete_required,
        items=item_responses
    )


def find_matching_template(
    db: Session,
    asset_category: Optional[str] = None,
    maintenance_type_id: Optional[int] = None
) -> Optional[ChecklistTemplate]:
    """Finds the best matching active inspection template for an asset category or maintenance type."""
    query = db.query(ChecklistTemplate).filter(ChecklistTemplate.is_active == True)
    
    # 1. Match both maintenance type and asset category
    if maintenance_type_id and asset_category:
        match = query.filter(
            ChecklistTemplate.maintenance_type_id == maintenance_type_id,
            ChecklistTemplate.asset_category.ilike(f"%{asset_category.strip()}%")
        ).first()
        if match:
            return match

    # 2. Match asset category
    if asset_category:
        match = query.filter(
            ChecklistTemplate.asset_category.ilike(f"%{asset_category.strip()}%")
        ).first()
        if match:
            return match

    # 3. Match maintenance type
    if maintenance_type_id:
        match = query.filter(ChecklistTemplate.maintenance_type_id == maintenance_type_id).first()
        if match:
            return match

    # 4. Fallback to general template
    return query.filter(
        or_(ChecklistTemplate.asset_category == None, ChecklistTemplate.asset_category == "General")
    ).first()


def initialize_work_order_checklist(
    db: Session,
    wo_id: int,
    template_id: Optional[int] = None,
    custom_title: Optional[str] = None
) -> WorkOrderChecklist:
    """
    Initializes a checklist on a work order by snapshotting template items into the work order instance.
    This guarantees that future template edits will not alter existing historical inspection responses.
    """
    wo = db.query(WorkOrder).filter(WorkOrder.id == wo_id).first()
    if not wo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Work order {wo_id} not found.")

    # Check if a checklist is already initialized for this work order
    existing = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo_id).first()
    if existing:
        return existing

    # Find template
    template = None
    if template_id:
        template = db.query(ChecklistTemplate).filter(ChecklistTemplate.id == template_id).first()
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Checklist template {template_id} not found.")
    else:
        # Auto-match template based on asset category or maintenance type
        asset_cat = wo.asset.category if wo.asset else None
        template = find_matching_template(db, asset_category=asset_cat, maintenance_type_id=wo.maintenance_type_id)

    title = custom_title or (template.title if template else f"Inspection Checklist for {wo.work_order_number}")
    
    checklist = WorkOrderChecklist(
        work_order_id=wo.id,
        template_id=template.id if template else None,
        title=title,
        summary_notes=None
    )
    db.add(checklist)
    db.flush()

    # Snapshot items from template
    if template and template.items:
        for it in template.items:
            wo_item = WorkOrderChecklistItem(
                checklist_id=checklist.id,
                order_index=it.order_index,
                item_text=it.item_text,
                description=it.description,
                is_required=it.is_required,
                status="PENDING"
            )
            db.add(wo_item)
    else:
        # Default baseline safety check if no template items exist
        default_items = [
            ("Verify physical equipment condition and mounting security", "Inspect structural integrity", True),
            ("Check operating fluid, oil, and coolant levels", "Verify level within operating markers", True),
            ("Test emergency stop buttons and safety interlocks", "Confirm immediate cutout operation", True),
            ("Inspect electrical cables and terminals for wear or hot spots", "Ensure proper insulation and ground", True),
        ]
        for idx, (txt, desc, req) in enumerate(default_items, start=1):
            db.add(WorkOrderChecklistItem(
                checklist_id=checklist.id,
                order_index=idx,
                item_text=txt,
                description=desc,
                is_required=req,
                status="PENDING"
            ))

    db.commit()
    db.refresh(checklist)
    return checklist


def update_checklist_item_response(
    db: Session,
    wo_id: int,
    item_id: int,
    status_val: Optional[str] = None,
    notes: Optional[str] = None,
    inspected_by: Optional[str] = None
) -> WorkOrderChecklistItem:
    """Updates a single checklist item response with PASS, FAIL, or NOT_APPLICABLE and technician notes."""
    checklist = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo_id).first()
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Checklist for work order {wo_id} not found.")

    item = db.query(WorkOrderChecklistItem).filter(
        WorkOrderChecklistItem.id == item_id,
        WorkOrderChecklistItem.checklist_id == checklist.id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Checklist item {item_id} not found.")

    if status_val:
        upper_status = status_val.upper()
        if upper_status not in {"PENDING", "PASS", "FAIL", "NOT_APPLICABLE"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid status '{status_val}'. Allowed values: PASS, FAIL, NOT_APPLICABLE, PENDING."
            )
        item.status = upper_status
        item.inspected_at = datetime.now(timezone.utc)

    if notes is not None:
        item.notes = notes.strip()

    if inspected_by is not None:
        item.inspected_by = inspected_by.strip()

    db.commit()
    db.refresh(item)
    return item


async def save_checklist_evidence_attachment(
    db: Session,
    wo_id: int,
    item_id: int,
    file: UploadFile
) -> WorkOrderChecklistItem:
    """
    Validates and securely stores evidence attachments (photos, PDFs, test logs) for an inspection item.
    Enforces file size limits, extension whitelisting, MIME type checks, and directory traversal prevention.
    """
    ensure_upload_dir()

    checklist = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo_id).first()
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Checklist for work order {wo_id} not found.")

    item = db.query(WorkOrderChecklistItem).filter(
        WorkOrderChecklistItem.id == item_id,
        WorkOrderChecklistItem.checklist_id == checklist.id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Checklist item {item_id} not found.")

    # 1. Validate Extension
    raw_filename = file.filename or "evidence"
    _, ext = os.path.splitext(raw_filename)
    clean_ext = ext.lower()
    if clean_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Disallowed file extension '{clean_ext}'. Allowed formats: JPG, PNG, WEBP, PDF, TXT."
        )

    # 2. Validate MIME Type
    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Disallowed file content type '{content_type}'."
        )

    # 3. Read & Validate File Size
    content = await file.read()
    file_size = len(content)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
            detail=f"File exceeds maximum allowed size of 5 MB (size: {file_size / (1024 * 1024):.2f} MB)."
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes)."
        )

    # 4. Secure Filename Generation (prevents directory traversal and overwrites)
    safe_base = sanitize_filename(raw_filename)
    unique_filename = f"{uuid.uuid4().hex}_{safe_base}"
    target_path = os.path.join(UPLOAD_DIR, unique_filename)

    # Ensure path stays within UPLOAD_DIR
    if not os.path.abspath(target_path).startswith(UPLOAD_DIR):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file destination path.")

    # Clean up previous attachment if exists
    if item.attachment_path and os.path.isfile(item.attachment_path):
        try:
            os.remove(item.attachment_path)
        except OSError:
            pass

    # Save to disk
    with open(target_path, "wb") as f:
        f.write(content)

    item.attachment_path = target_path
    item.attachment_filename = safe_base
    item.attachment_content_type = content_type or "application/octet-stream"
    item.attachment_file_size = file_size
    item.inspected_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(item)
    return item


def get_checklist_attachment_path(
    db: Session,
    wo_id: int,
    item_id: int
) -> Tuple[str, str, str]:
    """Retrieves safe local file path, original filename, and content type with traversal protection."""
    checklist = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo_id).first()
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found.")

    item = db.query(WorkOrderChecklistItem).filter(
        WorkOrderChecklistItem.id == item_id,
        WorkOrderChecklistItem.checklist_id == checklist.id
    ).first()
    if not item or not item.attachment_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found for this item.")

    abs_path = os.path.abspath(item.attachment_path)
    if not abs_path.startswith(UPLOAD_DIR) or not os.path.isfile(abs_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment file not found on disk.")

    return abs_path, item.attachment_filename or "evidence", item.attachment_content_type or "application/octet-stream"


def remove_checklist_evidence_attachment(
    db: Session,
    wo_id: int,
    item_id: int
) -> WorkOrderChecklistItem:
    """Removes an attachment from an item safely."""
    checklist = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo_id).first()
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found.")

    item = db.query(WorkOrderChecklistItem).filter(
        WorkOrderChecklistItem.id == item_id,
        WorkOrderChecklistItem.checklist_id == checklist.id
    ).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist item not found.")

    if item.attachment_path and os.path.isfile(item.attachment_path):
        try:
            os.remove(item.attachment_path)
        except OSError:
            pass

    item.attachment_path = None
    item.attachment_filename = None
    item.attachment_content_type = None
    item.attachment_file_size = None

    db.commit()
    db.refresh(item)
    return item


def complete_work_order_checklist(
    db: Session,
    wo_id: int,
    summary_notes: Optional[str] = None,
    completed_by: Optional[str] = None
) -> WorkOrderChecklist:
    """
    Marks a checklist as complete after validating that all required items have been inspected.
    Prevents completion if any required items are still PENDING.
    """
    checklist = db.query(WorkOrderChecklist).filter(WorkOrderChecklist.work_order_id == wo_id).first()
    if not checklist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Checklist for work order {wo_id} not found.")

    # Check incomplete required items
    items = checklist.items or []
    incomplete_required = [i for i in items if i.is_required and i.status == "PENDING"]
    if incomplete_required:
        item_names = [f"Item #{i.order_index}: '{i.item_text}'" for i in incomplete_required[:3]]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Cannot complete checklist: {len(incomplete_required)} required item(s) are still PENDING ({'; '.join(item_names)})."
        )

    checklist.completed_at = datetime.now(timezone.utc)
    if completed_by:
        checklist.completed_by = completed_by.strip()
    if summary_notes:
        checklist.summary_notes = summary_notes.strip()

    db.commit()
    db.refresh(checklist)
    return checklist
