"""
AI Trainer related routes
"""

import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import ChatRequest, Message
from services.trainer_service import create_trainer_agent
from services.session_service import session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trainer", tags=["trainer"])


def generate_trainer_stream_content(user_message: str, session_id: str, user_id: str = "default"):
    """Generate streaming response content specifically for the AI Trainer"""
    try:
        # Create the specialized AI Trainer Agent with RAG enabled
        user_agent = create_trainer_agent(
            session_id=session_id, 
            user_id=user_id
        )
        stream = user_agent.run(user_message, user_id=user_id, session_id=session_id, stream=True)
        
        full_content = ""
        for chunk in stream:
            content = ""
            
            # Compatible with different agno/phidata returns
            if isinstance(chunk, str):
                content = chunk
            elif isinstance(chunk, dict):
                content = chunk.get("content", chunk.get("delta", ""))
            elif hasattr(chunk, "content") and chunk.content:
                content = chunk.content
            elif hasattr(chunk, "delta") and chunk.delta:
                content = chunk.delta
            elif hasattr(chunk, "message") and isinstance(chunk.message, str):
                content = chunk.message
                
            if content:
                full_content += content
                yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
        
        # Save Agent reply to session database
        ai_msg = Message(content=full_content, role="assistant")
        session_service.add_message(session_id, ai_msg)
        
        yield f"data: {json.dumps({'content': '', 'done': True, 'full_content': full_content})}\n\n"
        
    except Exception as e:
        logger.error(f"Trainer stream error: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


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
    
    user_msg = Message(content=user_message, role="user")
    session_service.add_message(session.id, user_msg)
    
    return StreamingResponse(
        generate_trainer_stream_content(user_message, session.id, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session.id
        }
    )
