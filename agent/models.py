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
    chat_board_mode: bool = False


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
