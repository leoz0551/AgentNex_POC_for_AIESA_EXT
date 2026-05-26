"""
会话管理路由
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from models import (
    SessionCreate, SessionUpdate, SessionSummary, SessionDetail,
    ChatResponse, Message, MessageFeedback, FeedbackStats, FeedbackItem
)
from services.session_service import session_service
from services.agent_service import create_agent_for_request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=Dict[str, Any])
async def get_sessions():
    """获取所有会话列表"""
    sessions_list = []
    for session in session_service.get_all():
        sessions_list.append(SessionSummary(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=len(session.messages)
        ))
    
    sessions_list.sort(key=lambda x: x.updated_at, reverse=True)
    
    return {"sessions": [s.model_dump() for s in sessions_list]}


@router.post("", response_model=SessionDetail)
async def create_session(request: SessionCreate = SessionCreate(), user_id: str = "default"):
    """创建新会话"""
    from models import Session
    session = Session(title=request.title, user_id=user_id)
    # 直接添加到 session_service
    session_service._sessions[session.id] = session
    logger.info(f"Created session: {session.id} for user: {user_id}")
    return session


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(session_id: str):
    """获取会话详情"""
    session = session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """删除会话"""
    if not session_service.delete(session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "ok", "message": "Session deleted"}


@router.patch("/{session_id}", response_model=SessionDetail)
async def update_session(session_id: str, request: SessionUpdate):
    """更新会话标题"""
    session = session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.title = request.title
    from datetime import datetime
    session.updated_at = datetime.now()
    return session


# ==================== 消息操作 ====================

@router.post("/messages/{message_id}/feedback")
async def message_feedback(message_id: str, request: MessageFeedback):
    """消息反馈（点赞/点踩）"""
    if request.feedback not in ["like", "dislike"]:
        raise HTTPException(status_code=400, detail="Feedback must be 'like' or 'dislike'")
    
    result = session_service.find_message_by_id(message_id)
    if not result:
        raise HTTPException(status_code=404, detail="Message not found")
    
    _, msg = result
    msg.feedback = request.feedback
    
    # 获取原始问题
    user_prompt = "Unknown"
    session, _ = result
    for i, m in enumerate(session.messages):
        if m.id == message_id and i > 0:
            user_prompt = session.messages[i-1].content
            break

    # 如果是点赞，自动记录到详细反馈表以便统计
    if request.feedback == "like":
        try:
            feedback_service.save_detailed_feedback(
                message_id=message_id,
                feedback_type="like",
                user_id="default", # TODO: get from session
                user_prompt=user_prompt
            )
        except Exception as e:
            logger.error(f"Failed to auto-record like feedback: {e}")
            
    return {"status": "ok", "message": "Feedback recorded"}


@router.get("/feedback/stats", response_model=FeedbackStats)
async def get_feedback_stats(user_id: str = "default"):
    """获取反馈统计"""
    stats = feedback_service.get_feedback_stats(user_id)
    return stats


@router.get("/feedback/list", response_model=Dict[str, Any])
async def get_feedback_list(user_id: str = "default", status: str = "All", keyword: str = ""):
    """获取反馈列表"""
    items = feedback_service.get_feedback_list(user_id, status, keyword)
    return {"feedbacks": items}


from fastapi import File, UploadFile, Form
from typing import Optional
from services.feedback_service import feedback_service

@router.post("/messages/{message_id}/detailed-feedback")
async def submit_detailed_feedback(
    message_id: str,
    category: str = Form(...),
    what_went_wrong: str = Form(...),
    additional_content: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None)
):
    """提交详细反馈（包含问题、类别和附件）"""
    try:
        # 确认消息存在
        result = session_service.find_message_by_id(message_id)
        if not result:
            raise HTTPException(status_code=404, detail="Message not found")
            
        # 获取原始问题
        user_prompt = "Unknown"
        session, _ = result
        for i, m in enumerate(session.messages):
            if m.id == message_id and i > 0:
                user_prompt = session.messages[i-1].content
                break

        feedback = feedback_service.save_detailed_feedback(
            message_id=message_id,
            category=category,
            what_went_wrong=what_went_wrong,
            additional_content=additional_content,
            attachment=attachment,
            user_prompt=user_prompt
        )
        
        return {"status": "ok", "feedback": feedback.model_dump()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting detailed feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/regenerate")
async def regenerate_message(session_id: str):
    """重新生成最后一条 AI 回复"""
    session = session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    last_user_msg = session_service.get_last_user_message(session_id)
    last_ai_msg_index = session_service.get_last_ai_message_index(session_id)
    
    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found to regenerate")
    
    try:
        user_id = session.user_id or "default"
        user_agent = create_agent_for_request(last_user_msg.content, user_id)
        response = user_agent.run(last_user_msg.content)
        ai_content = response.content if hasattr(response, 'content') else str(response)
        
        if last_ai_msg_index >= 0:
            session_service.update_message(session_id, last_ai_msg_index, ai_content)
            new_msg = session.messages[last_ai_msg_index]
        else:
            new_msg = Message(content=ai_content, role="assistant")
            session_service.add_message(session_id, new_msg)
        
        return ChatResponse(
            content=ai_content,
            role="assistant",
            session_id=session.id,
            message_id=new_msg.id
        )
        
    except Exception as e:
        logger.error(f"Regenerate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
