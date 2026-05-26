"""
Pydantic 数据模型定义
"""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ==================== 聊天相关模型 ====================

class ChatMessage(BaseModel):
    content: str
    role: str = "user"


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    session_id: Optional[str] = None
    user_id: Optional[str] = "default"
    stream: bool = False
    web_search_enabled: bool = True


class ChatResponse(BaseModel):
    content: str
    role: str = "assistant"
    session_id: Optional[str] = None
    message_id: Optional[str] = None


# ==================== 消息模型 ====================

class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    role: str
    timestamp: datetime = Field(default_factory=datetime.now)
    feedback: Optional[str] = None


# ==================== 会话模型 ====================

class Session(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "新对话"
    user_id: str = "default"
    messages: List[Message] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class SessionCreate(BaseModel):
    title: Optional[str] = "新对话"


class SessionUpdate(BaseModel):
    title: str


class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class SessionDetail(BaseModel):
    id: str
    title: str
    messages: List[Message]
    created_at: datetime
    updated_at: datetime


# ==================== 消息反馈模型 ====================

class MessageFeedback(BaseModel):
    feedback: str


class DetailedFeedback(BaseModel):
    message_id: str
    user_id: Optional[str] = "default"
    type: str = "dislike"
    category: Optional[str] = None
    what_went_wrong: Optional[str] = None
    additional_content: Optional[str] = None
    attachment_path: Optional[str] = None
    status: str = "Open"
    user_prompt: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class FeedbackItem(BaseModel):
    id: int
    message_id: str
    session_id: str
    user_prompt: str
    type: str  # 'like', 'dislike'
    category: Optional[str] = None
    status: str
    timestamp: datetime
    comment_count: int = 0


class FeedbackStats(BaseModel):
    total: int
    likes: int
    dislikes: int
    comments: int


# ==================== 知识库模型 ====================

class KnowledgeDocument(BaseModel):
    id: str
    name: str
    type: str
    created_at: datetime
    chunk_count: int


# ==================== 记忆模型 ====================

class MemoryItem(BaseModel):
    memory_id: str
    memory: str
    topics: List[str]
    user_id: str
    updated_at: int
