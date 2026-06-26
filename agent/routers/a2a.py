import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.responses import StreamingResponse

from models_a2a import A2ARequest, A2AResponse, A2AResponseResult
from models import Message
from services.session_service import session_service
from workflows.trainer_workflow import TrainerCourseWorkflow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/a2a", tags=["a2a"])

API_KEY_NAME = "Authorization"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def verify_api_key(api_key: str = Security(api_key_header)):
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key is missing")
    token = api_key.replace("Bearer ", "").strip()
    if token != "tk-fdaoa8x9m2q5j1s3b7v4c6n8z9m0w2p5l7k4j1h8g6f3d2s":
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return token

@router.get("/.well-known/agent.json")
async def get_agent_card():
    """Agent card endpoint for Copilot Studio to discover the agent (A2A protocol spec)."""
    return {
        "name": "AI Trainer Agent",
        "description": "An AI Trainer agent capable of guiding users through courses and providing training assistance.",
        "url": "https://agentnex.cc/a2a/trainer/v1/message:stream",
        "version": "0.3.0",
        "capabilities": {
            "streaming": True,
            "pushNotifications": False,
            "stateTransitionHistory": False
        },
        "defaultInputModes": ["text"],
        "defaultOutputModes": ["text"],
        "skills": [
            {
                "id": "ai-trainer-guidance",
                "name": "AI Training Guidance",
                "description": "Provides detailed training guidance, step-by-step instructions, and answers questions about courses and learning materials."
            }
        ]
    }

@router.post("/trainer/{version}/message:stream")
async def a2a_trainer_stream(version: str, request: A2ARequest, api_key: str = Depends(verify_api_key)):
    """Handle A2A chat requests over HTTP with streaming response (JSON-RPC over SSE)."""
    
    if request.method != "message/send":
        raise HTTPException(status_code=400, detail="Unsupported method. Expected 'message/send'")

    message_params = request.params.message
    session_id = message_params.contextId
    
    # Extract the user's latest query
    user_message_text = ""
    
    # 优先从 parts 提取 (这是 Copilot Studio 分发给子 Agent 的真实指令)
    if message_params.parts:
        for part in message_params.parts:
            if part.kind == "text":
                user_message_text = part.text
                break
                
    if not user_message_text and message_params.metadata and message_params.metadata.chathistory:
        # Fallback: parse chathistory which might be wrapped in {"HasValue": true, "Value": [...]}
        history_list = message_params.metadata.chathistory
        if isinstance(history_list, list) and len(history_list) > 0:
            first_item = history_list[0]
            if isinstance(first_item, dict) and "Value" in first_item:
                real_history = first_item["Value"]
            else:
                real_history = history_list
                
            for msg in reversed(real_history):
                # Sometimes From is "" for the user, or "user"
                sender = msg.get("From", "").lower()
                if sender == "user" or sender == "":
                    user_message_text = msg.get("Text", "")
                    break
                
    if not user_message_text:
        # Fallback if there is no chathistory or no user message
        logger.warning(f"[A2A] No user message found in chathistory. Raw payload: {request.model_dump_json()}")
        raise HTTPException(status_code=400, detail="No user message found in chathistory")

    user_id = "a2a_user" # We could extract user info if provided in metadata
    logger.info(f"[A2A] Processing message for session {session_id}: {user_message_text}")

    session = session_service.get_or_create(session_id)
    session.user_id = user_id

    # Save user message to session
    user_msg = Message(content=user_message_text, role="user")
    session_service.add_message(session.id, user_msg)

    workflow = TrainerCourseWorkflow(session_id=session.id, user_id=user_id)
    original_req_id = request.id or "1"
    import uuid
    import time as _time
    import json
    start_time = _time.monotonic()
    
    full_content = ""
    # Collect stream outputs into a single string synchronously
    try:
        for chunk in workflow.run_stream(user_message_text):
            raw_chunk = chunk
            if chunk.startswith("data: "):
                raw_chunk = chunk[6:]
            raw_chunk = raw_chunk.strip()
            if not raw_chunk:
                continue
            try:
                data_dict = json.loads(raw_chunk)
                full_content += data_dict.get("content", "")
            except json.JSONDecodeError:
                full_content += raw_chunk
    except Exception as e:
        logger.error(f"[A2A] Workflow error: {e}")
        full_content = f"Sorry, an error occurred during processing: {e}"

    elapsed = _time.monotonic() - start_time
    logger.info(f"[A2A] Response generated | session: {session_id[:8]} | elapsed: {elapsed:.1f}s")

    from models_a2a import A2AResponse, A2AResponseResult, A2AResponseMessage
    
    response = A2AResponse(
        jsonrpc="2.0",
        id=original_req_id,
        result=A2AResponseResult(
            message=A2AResponseMessage(
                contextId=session.id,
                messageId=str(uuid.uuid4()),
                content=full_content
            )
        )
    )

    return response
