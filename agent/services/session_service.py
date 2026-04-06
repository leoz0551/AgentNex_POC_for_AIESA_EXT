"""
会话服务模块
负责会话的存储和管理
"""

import logging
from datetime import datetime
from typing import Dict, Optional, List

from models import Session, Message

logger = logging.getLogger(__name__)


class SessionService:
    """会话管理服务"""
    
    def __init__(self):
        self._sessions: Dict[str, Session] = {}
    
    def get_or_create(self, session_id: Optional[str] = None) -> Session:
        """获取或创建会话"""
        if session_id and session_id in self._sessions:
            return self._sessions[session_id]
        
        session = Session()
        self._sessions[session.id] = session
        return session
    
    def get(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        return self._sessions.get(session_id)
    
    def delete(self, session_id: str) -> bool:
        """删除会话"""
        if session_id in self._sessions:
            del self._sessions[session_id]
            logger.info(f"Deleted session: {session_id}")
            return True
        return False
    
    def get_all(self) -> List[Session]:
        """获取所有会话"""
        return list(self._sessions.values())
    
    def count(self) -> int:
        """获取会话数量"""
        return len(self._sessions)
    
    def add_message(self, session_id: str, message: Message) -> bool:
        """向会话添加消息"""
        session = self.get(session_id)
        if not session:
            return False
        
        session.messages.append(message)
        session.updated_at = datetime.now()
        
        # 如果是第一条用户消息，设置会话标题
        if len(session.messages) == 2 and message.role == "assistant":
            user_msg = session.messages[0]
            session.title = user_msg.content[:20] + ("..." if len(user_msg.content) > 20 else "")
        
        return True
    
    def get_last_user_message(self, session_id: str) -> Optional[Message]:
        """获取会话中最后一条用户消息"""
        session = self.get(session_id)
        if not session:
            return None
        
        for msg in reversed(session.messages):
            if msg.role == "user":
                return msg
        return None
    
    def get_last_ai_message_index(self, session_id: str) -> int:
        """获取最后一条 AI 消息的索引"""
        session = self.get(session_id)
        if not session:
            return -1
        
        for i in range(len(session.messages) - 1, -1, -1):
            if session.messages[i].role == "assistant":
                return i
        return -1
    
    def update_message(self, session_id: str, message_index: int, content: str) -> bool:
        """更新消息内容"""
        session = self.get(session_id)
        if not session or message_index < 0 or message_index >= len(session.messages):
            return False
        
        session.messages[message_index].content = content
        session.updated_at = datetime.now()
        return True
    
    def find_message_by_id(self, message_id: str) -> Optional[tuple]:
        """
        根据消息 ID 查找消息
        
        Returns:
            (session, message) 元组，如果找不到返回 None
        """
        for session in self._sessions.values():
            for msg in session.messages:
                if msg.id == message_id:
                    return (session, msg)
        return None

    def save_ppt_outline(self, session_id: str, outline: str) -> bool:
        """Save the most recently generated PPT outline to the session."""
        session = self.get(session_id)
        if not session:
            return False
        session.last_ppt_outline = outline
        logger.info(f"Saved PPT outline ({len(outline)} chars) to session {session_id}")
        return True

    def get_ppt_outline(self, session_id: str) -> Optional[str]:
        """Retrieve the most recently saved PPT outline for a session."""
        session = self.get(session_id)
        if not session:
            return None
        return session.last_ppt_outline


# 全局单例
session_service = SessionService()
