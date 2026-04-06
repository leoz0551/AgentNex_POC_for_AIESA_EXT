"""
聊天相关路由
"""

import re
import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import ChatRequest, ChatResponse, Message
from services.agent_service import create_agent_for_request
from services.session_service import session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


# ==================== PPT Context Helpers ====================

# Keywords indicating a PPT modification intent
_PPT_MODIFY_KEYWORDS = [
    "修改", "替换", "更新", "添加", "重新生成", "再加", "加上", "删除", "重做",
    "replace", "update", "change", "add", "modify", "regenerate", "revise", "redo",
]

# PPT reference keywords (to confirm this is about a PPT)
_PPT_REF_KEYWORDS = ["ppt", "slide", "大纲", "presentation", "幻灯片"]

# Marker for a complete PPT generation response (contains download link)
_PPT_DOWNLOAD_MARKER = re.compile(r"\[Download the PPT\]|download.*?\.pdf", re.IGNORECASE)

# Pattern to detect a PPT outline (at least 2 slide markers in content)
_PPT_SLIDE_PATTERN = re.compile(r"第\s*\d+\s*[页张]|slide\s*\d+", re.IGNORECASE)


def _is_ppt_modification_request(user_message: str) -> bool:
    """Detect if the user is asking to modify an existing PPT."""
    msg_lower = user_message.lower()
    has_ppt_ref = any(kw in msg_lower for kw in _PPT_REF_KEYWORDS)
    has_modify_action = any(kw in msg_lower for kw in _PPT_MODIFY_KEYWORDS)
    return has_ppt_ref and has_modify_action


def _try_save_ppt_outline(session_id: str, ai_response: str) -> None:
    """
    After each AI response, check if it's a complete PPT generation
    (contains a download link AND slide content). If so, save the
    outline to the session's dedicated `last_ppt_outline` slot.
    """
    has_download_link = bool(_PPT_DOWNLOAD_MARKER.search(ai_response))
    slide_matches = _PPT_SLIDE_PATTERN.findall(ai_response)
    has_multiple_slides = len(slide_matches) >= 2

    if has_download_link and has_multiple_slides:
        # Extract content BEFORE the download link as the outline
        parts = re.split(r"\[Download the PPT\]", ai_response, flags=re.IGNORECASE)
        outline = parts[0].strip() if parts else ai_response
        session_service.save_ppt_outline(session_id, outline)
        logger.info(f"Auto-saved PPT outline to session {session_id}.")


# ==================== Stream Generator ====================

def generate_stream_content(
    user_message: str,
    session_id: str,
    user_id: str = "default",
    web_search_enabled: bool = True,
    ppt_context: Optional[str] = None,
):
    """生成流式响应内容"""
    try:
        user_agent = create_agent_for_request(
            user_message, user_id, session_id, web_search_enabled, ppt_context
        )
        stream = user_agent.run(
            user_message,
            user_id=user_id,
            session_id=session_id,
            stream=True,
        )

        full_content = ""
        for chunk in stream:
            content = ""
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
            else:
                logger.debug(f"Skipped unknown or empty chunk: {type(chunk)} - {chunk}")

        # Save AI reply to session
        ai_msg = Message(content=full_content, role="assistant")
        session_service.add_message(session_id, ai_msg)

        # Auto-save PPT outline if this response contains a full PPT
        _try_save_ppt_outline(session_id, full_content)

        yield f"data: {json.dumps({'content': '', 'done': True, 'full_content': full_content})}\n\n"

    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


# ==================== Routes ====================

@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """处理聊天请求（非流式）"""
    try:
        if not request.messages:
            raise HTTPException(status_code=400, detail="No messages provided")

        user_message = request.messages[-1].content if request.messages else ""
        if not user_message:
            raise HTTPException(status_code=400, detail="Empty user message")

        user_id = request.user_id or "default"
        logger.info(f"Processing message from user {user_id}: {user_message}")

        session = session_service.get_or_create(request.session_id)
        session.user_id = user_id

        # Retrieve saved PPT outline if this is a modification request
        ppt_context = None
        if _is_ppt_modification_request(user_message):
            ppt_context = session_service.get_ppt_outline(session.id)
            if ppt_context:
                logger.info(f"PPT modification detected: injecting saved outline ({len(ppt_context)} chars).")
            else:
                logger.info("PPT modification detected but no saved outline found in session.")

        user_msg = Message(content=user_message, role="user")
        session_service.add_message(session.id, user_msg)

        user_agent = create_agent_for_request(
            user_message, user_id, session.id, request.web_search_enabled, ppt_context
        )
        response = user_agent.run(user_message, user_id=user_id, session_id=session.id)
        ai_content = response.content if hasattr(response, "content") else str(response)

        ai_msg = Message(content=ai_content, role="assistant")
        session_service.add_message(session.id, ai_msg)

        # Auto-save PPT outline if response contains a complete PPT
        _try_save_ppt_outline(session.id, ai_content)

        return ChatResponse(
            content=ai_content,
            role="assistant",
            session_id=session.id,
            message_id=ai_msg.id,
        )

    except Exception as e:
        error_msg = f"Error processing chat request: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """处理聊天请求（流式输出）"""
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    user_message = request.messages[-1].content if request.messages else ""
    if not user_message:
        raise HTTPException(status_code=400, detail="Empty user message")

    user_id = request.user_id or "default"
    logger.info(f"Processing stream message from user {user_id}: {user_message}")

    session = session_service.get_or_create(request.session_id)
    session.user_id = user_id

    # Retrieve saved PPT outline if this is a modification request
    ppt_context = None
    if _is_ppt_modification_request(user_message):
        ppt_context = session_service.get_ppt_outline(session.id)
        if ppt_context:
            logger.info(f"PPT modification detected: injecting saved outline ({len(ppt_context)} chars).")
        else:
            logger.info("PPT modification detected but no saved outline found in session.")

    user_msg = Message(content=user_message, role="user")
    session_service.add_message(session.id, user_msg)

    return StreamingResponse(
        generate_stream_content(user_message, session.id, user_id, request.web_search_enabled, ppt_context),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session.id,
        },
    )
