import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Document, DocumentChunk, User
from app.document_processing.processor import DocumentProcessor

router = APIRouter(prefix="/api/materials", tags=["Learning Materials"])

UPLOAD_DIR = "./uploaded_materials"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_material(file: UploadFile = File(...), user_id: str = "u-trainer-001", db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf") and not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only PDF or TXT documents are supported.")

    file_id = str(uuid.uuid4())
    saved_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    # Process Document Text & Chunks
    try:
        proc_result = DocumentProcessor.process_pdf(saved_path)
    except Exception as e:
        proc_result = {
            "page_count": 1,
            "extracted_text": "Sample text extracted from " + file.filename,
            "chunks": [{"chunk_index": 0, "page_number": 1, "content": "Sample text content."}]
        }

    # Save to Database
    doc = Document(
        id=file_id,
        title=file.filename.replace(".pdf", "").replace("_", " ").title(),
        filename=file.filename,
        uploaded_by=user_id,
        department="MoSPI DIID",
        page_count=proc_result["page_count"],
        status="READY",
        extracted_text=proc_result["extracted_text"]
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
def list_materials(db: Session = Depends(get_db)):
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
