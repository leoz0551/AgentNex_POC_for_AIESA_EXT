"""
AI Trainer related routes

The router layer is intentionally minimal.
All multi-agent orchestration logic lives in workflows/trainer_workflow.py.
"""

import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import ChatRequest, Message
from services.session_service import session_service
from workflows.trainer_workflow import TrainerCourseWorkflow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trainer", tags=["trainer"])


@router.post("/chat/stream")
async def trainer_chat_stream(request: ChatRequest):
    """Handle training chat request with streaming output"""
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    user_message = request.messages[-1].content if request.messages else ""
    if not user_message:
        raise HTTPException(status_code=400, detail="Empty user message")

    user_id = request.user_id or "default"
    logger.info(f"Processing trainer stream message from user {user_id}: {user_message}")

    session = session_service.get_or_create(request.session_id)
    session.user_id = user_id

    # Save user message to session
    user_msg = Message(content=user_message, role="user")
    session_service.add_message(session.id, user_msg)

    # Create Workflow and delegate everything to it
    workflow = TrainerCourseWorkflow(session_id=session.id, user_id=user_id)

    return StreamingResponse(
        workflow.run_stream(user_message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session.id
        }
    )
