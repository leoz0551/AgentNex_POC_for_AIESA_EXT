"""
数据库和向量库初始化模块
"""

import os
import logging
from agno.db.sqlite import SqliteDb
from agno.knowledge.knowledge import Knowledge
from agno.vectordb.chroma import ChromaDb
from agno.knowledge.embedder.openai import OpenAIEmbedder

from config import (
    DB_FILE,
    CHROMA_DIR,
    EMBEDDER_ID,
    EMBEDDER_BASE_URL,
    CHROMA_COLLECTION_NAME,
    OPENROUTER_API_KEY,
)

logger = logging.getLogger(__name__)

# ==================== SQLite 数据库 ====================

db = SqliteDb(db_file=str(DB_FILE))

# ==================== ChromaDB 向量数据库 ====================

# 确保 ChromaDB 目录存在
CHROMA_DIR.mkdir(exist_ok=True)
logger.info(f"ChromaDB directory: {CHROMA_DIR}, exists: {CHROMA_DIR.exists()}")

# 使用 OpenRouter Qwen3 Embedding API（兼容 OpenAI 格式）
embedder = OpenAIEmbedder(
    id=EMBEDDER_ID,
    api_key=OPENROUTER_API_KEY,
    base_url=EMBEDDER_BASE_URL,
    dimensions=4096,  # qwen3-embedding-8b 维度
)

chroma_db = ChromaDb(
    collection=CHROMA_COLLECTION_NAME,
    path=str(CHROMA_DIR),
    embedder=embedder,
)

# 确保集合存在
try:
    chroma_db.create()
    logger.info(f"ChromaDB collection created/verified: {CHROMA_COLLECTION_NAME}")
    
    # 调试：检查向量数量
    try:
        vector_count = chroma_db.get_count() if hasattr(chroma_db, 'get_count') else 0
        logger.info(f"Initial vector count in ChromaDB: {vector_count}")
    except Exception as e:
        logger.warning(f"Could not get initial vector count: {e}")
        
except Exception as e:
    logger.error(f"Failed to create ChromaDB collection: {e}")
    raise

# ==================== 知识库实例 ====================

knowledge = Knowledge(vector_db=chroma_db)


# ==================== SQLAlchemy (用于自定义业务数据) ====================

from sqlalchemy import create_engine, Column, String, Text, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime

# SQLite 数据库 URL
SQLALCHEMY_DATABASE_URL = f"sqlite:///./{DB_FILE}"

# 创建引擎
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 创建会话类
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 基类
Base = declarative_base()

class FeedbackTable(Base):
    """详细反馈表"""
    __tablename__ = "detailed_feedback"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String, index=True)
    user_id = Column(String, index=True, default="default")
    type = Column(String, default="dislike") # 'like' or 'dislike'
    category = Column(String, nullable=True)
    what_went_wrong = Column(Text, nullable=True)
    additional_content = Column(Text, nullable=True)
    attachment_path = Column(String, nullable=True)
    status = Column(String, default="Open") # 'Open', 'Not Issue', 'Resolved'
    user_prompt = Column(Text, nullable=True) #Original user prompt for context
    timestamp = Column(DateTime, default=datetime.datetime.now)

# 创建所有表
def init_db():
    Base.metadata.create_all(bind=engine)
    logger.info("Custom database tables initialized (FeedbackTable)")

# 初始调用
init_db()
