"""
聊天相关路由
"""

import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import ChatRequest, ChatResponse, Message
from services.agent_service import create_agent_for_request
from services.session_service import session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def generate_stream_content(user_message: str, session_id: str, user_id: str = "default"):
    """生成流式响应内容"""
    try:
        user_agent = create_agent_for_request(user_message, user_id)
        stream = user_agent.run(user_message, user_id=user_id, stream=True)
        
        full_content = ""
        for chunk in stream:
            if hasattr(chunk, 'content') and chunk.content:
                content = chunk.content
                full_content += content
                yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"
        
        # 保存 AI 回复到会话
        ai_msg = Message(content=full_content, role="assistant")
        session_service.add_message(session_id, ai_msg)
        
        yield f"data: {json.dumps({'content': '', 'done': True, 'full_content': full_content})}\n\n"
        
    except Exception as e:
        logger.error(f"Stream error: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


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
        
        user_msg = Message(content=user_message, role="user")
        session_service.add_message(session.id, user_msg)
        
        # 使用动态创建的 Agent
        user_agent = create_agent_for_request(user_message, user_id)
        response = user_agent.run(user_message, user_id=user_id)
        ai_content = response.content if hasattr(response, 'content') else str(response)
        
        ai_msg = Message(content=ai_content, role="assistant")
        session_service.add_message(session.id, ai_msg)
        
        return ChatResponse(
            content=ai_content,
            role="assistant",
            session_id=session.id,
            message_id=ai_msg.id
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
    
    user_msg = Message(content=user_message, role="user")
    session_service.add_message(session.id, user_msg)
    
    return StreamingResponse(
        generate_stream_content(user_message, session.id, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session.id
        }
    )
