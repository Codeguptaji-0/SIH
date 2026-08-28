import logging
import os
import re
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Document, DocumentChunk, User
from app.document_processing.processor import DocumentProcessor

from app.auth.dependencies import require_role

router = APIRouter(prefix="/api/materials", tags=["Learning Materials"])

logger = logging.getLogger(__name__)

UPLOAD_DIR = "./uploaded_materials"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Upload ceiling. Without one, a single request could read an arbitrarily large body
# into memory.
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

@router.post("/upload")
async def upload_material(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(require_role("TRAINER", "ADMIN"))
):
    original_name = os.path.basename(file.filename or "")
    if not original_name:
        raise HTTPException(status_code=400, detail="A filename is required.")

    lowered = original_name.lower()
    if not (lowered.endswith(".pdf") or lowered.endswith(".txt")):
        raise HTTPException(status_code=400, detail="Only PDF or TXT documents are supported.")

    file_id = str(uuid.uuid4())

    # Sanitise the name before it reaches the filesystem. The raw client-supplied
    # filename was interpolated straight into a path, so "../../etc/x.txt" wrote
    # outside UPLOAD_DIR.
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", original_name)[:120]
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_name}")

    # Bounded read. `await file.read()` with no limit let one request buy the whole
    # process's memory.
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    with open(saved_path, "wb") as f:
        f.write(content)

    # Extraction either succeeds or the document is recorded as FAILED. It previously
    # fabricated the string "Sample text extracted from <name>" plus a fake chunk, so a
    # PDF that could not be parsed still looked READY and then produced MCQs generated
    # from placeholder text.
    extraction_error = None
    try:
        proc_result = DocumentProcessor.process_pdf(saved_path)
    except Exception as exc:  # noqa: BLE001 - recorded, not swallowed
        logger.exception("Text extraction failed for %s", saved_path)
        extraction_error = str(exc)
        proc_result = {"page_count": 0, "extracted_text": "", "chunks": []}

    if not extraction_error and not (proc_result.get("extracted_text") or "").strip():
        extraction_error = (
            "No selectable text found. If this is a scanned document it needs OCR before "
            "questions can be generated from it."
        )

    # Save to Database
    doc = Document(
        id=file_id,
        title=original_name.rsplit(".", 1)[0].replace("_", " ").title(),
        filename=original_name,
        uploaded_by=user.id,
        department=getattr(user, "department", None) or "",
        page_count=proc_result.get("page_count", 0),
        # Status reflects what actually happened to this file.
        status="FAILED" if extraction_error else "READY",
        extracted_text=proc_result.get("extracted_text", "")
    )
    db.add(doc)

    for chk in proc_result["chunks"]:
        d_chunk = DocumentChunk(
            id=str(uuid.uuid4()),
            document_id=file_id,
            chunk_index=chk["chunk_index"],
            page_number=chk["page_number"],
            content=chk["content"]
        )
        db.add(d_chunk)

    db.commit()

    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "page_count": doc.page_count,
        "chunks_extracted": len(proc_result["chunks"]),
        "status": "READY"
    }

@router.get("")
def list_materials(
    db: Session = Depends(get_db),
    user=Depends(require_role("OFFICIAL", "TRAINER", "ADMIN"))
):
    docs = db.query(Document).all()
    return [{
        "id": d.id,
        "title": d.title,
        "filename": d.filename,
        "department": d.department,
        "page_count": d.page_count,
        "status": d.status,
        "created_at": d.created_at
    } for d in docs]
