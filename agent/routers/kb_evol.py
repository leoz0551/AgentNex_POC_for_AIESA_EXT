from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pathlib import Path
import json

from models_kb_evol import SessionLocal, KBEvolTask, AgentLog
from services.kb_evol_service import trigger_preparation_workflow

router = APIRouter(prefix="/kbevol", tags=["KBEvol"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class TriggerRequest(BaseModel):
    transcript: str

@router.post("/trigger")
async def trigger_kb_evol(request: TriggerRequest, background_tasks: BackgroundTasks):
    if not request.transcript:
        raise HTTPException(status_code=400, detail="Transcript is required")
        
    # Run the 3-step preparation workflow asynchronously
    background_tasks.add_task(trigger_preparation_workflow, request.transcript)
    return {"status": "Processing", "message": "Preparation workflow triggered successfully."}

@router.post("/upload-trigger")
async def upload_trigger_kb_evol(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    if not file:
        raise HTTPException(status_code=400, detail="File is required")
        
    filename = file.filename or "unknown"
    file_ext = Path(filename).suffix.lower()
    
    if file_ext not in [".txt", ".json", ".log"]:
        raise HTTPException(status_code=400, detail="Only .txt, .json, and .log files are supported")
        
    try:
        content_bytes = await file.read()
        # Decode contents dynamically
        try:
            transcript = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                transcript = content_bytes.decode("gbk")
            except UnicodeDecodeError:
                transcript = content_bytes.decode("utf-8", errors="ignore")
                
        # Parse JSON format if applicable
        if file_ext == ".json":
            try:
                data = json.loads(transcript)
                if isinstance(data, list):
                    formatted_lines = []
                    for item in data:
                        if isinstance(item, dict):
                            role = item.get("role") or item.get("speaker") or item.get("user") or "System"
                            content = item.get("content") or item.get("text") or item.get("message") or str(item)
                            formatted_lines.append(f"[{role}]: {content}")
                        else:
                            formatted_lines.append(str(item))
                    transcript = "\n".join(formatted_lines)
                elif isinstance(data, dict):
                    if "transcript" in data:
                        transcript = str(data["transcript"])
                    elif "dialogue" in data:
                        dialogue = data["dialogue"]
                        if isinstance(dialogue, list):
                            formatted_lines = []
                            for item in dialogue:
                                if isinstance(item, dict):
                                    role = item.get("role") or item.get("speaker") or "System"
                                    content = item.get("content") or item.get("text") or str(item)
                                    formatted_lines.append(f"[{role}]: {content}")
                                else:
                                    formatted_lines.append(str(item))
                            transcript = "\n".join(formatted_lines)
                        else:
                            transcript = str(dialogue)
                    else:
                        transcript = json.dumps(data, indent=2, ensure_ascii=False)
            except Exception as json_err:
                # If json is malformed, treat as raw text
                pass
                
        if not transcript.strip():
            raise HTTPException(status_code=400, detail="File content is empty")
            
        background_tasks.add_task(trigger_preparation_workflow, transcript)
        return {
            "status": "Processing",
            "message": f"Successfully parsed '{filename}' and triggered workflow.",
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks")
def get_tasks(db: Session = Depends(get_db)):
    tasks = db.query(KBEvolTask).options(joinedload(KBEvolTask.logs)).order_by(KBEvolTask.created_at.desc()).all()
    # Format exactly as the frontend expects
    result = {}
    for t in tasks:
        result[t.id] = {
            "id": f"#{t.id}",
            "title": t.title,
            "desc": t.desc,
            "status": t.status,
            "transcript": t.transcript,
            "gapCause": t.gap_cause or "Pending",
            "gapDesc": t.gap_desc or "Pending",
            "retrieved": t.retrieved_info or "N/A",
            "source": t.source or "N/A",
            "markdown": t.markdown or "",
            "progress": t.progress,
            "time": t.created_at.strftime("%Y-%m-%d %H:%M"),
            "completed_steps": [log.agent_name for log in t.logs] if t.logs else []
        }
    return result

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_calls = db.query(func.count(KBEvolTask.id)).scalar()
    
    success_count = db.query(func.count(KBEvolTask.id)).filter(KBEvolTask.gap_cause == "Success").scalar()
    failed_count = db.query(func.count(KBEvolTask.id)).filter(KBEvolTask.gap_cause == "Failed").scalar()
    aborted_count = db.query(func.count(KBEvolTask.id)).filter(KBEvolTask.gap_cause == "Aborted").scalar()
    escalated_count = db.query(func.count(KBEvolTask.id)).filter(KBEvolTask.gap_cause == "Escalated").scalar()
    
    total_classified = success_count + failed_count + aborted_count + escalated_count
    
    success_pct = 0
    failed_pct = 0
    aborted_pct = 0
    escalated_pct = 0
    
    if total_classified > 0:
        success_pct = int((success_count / total_classified) * 100)
        failed_pct = int((failed_count / total_classified) * 100)
        aborted_pct = int((aborted_count / total_classified) * 100)
        escalated_pct = int((escalated_count / total_classified) * 100)
        
    return {
        "total_calls": total_calls,
        "evaluation_ratios": {
            "success_pct": success_pct,
            "failed_pct": failed_pct,
            "aborted_pct": aborted_pct,
            "escalated_pct": escalated_pct
        },
        "root_causes": {
            "knowledge_lack_pct": failed_pct // 2,
            "search_mismatch_pct": failed_pct - (failed_pct // 2),
            "misunderstanding_pct": max(0, 100 - failed_pct)
        }
    }
