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
)

logger = logging.getLogger(__name__)

# ==================== SQLite 数据库 ====================

db = SqliteDb(db_file=str(DB_FILE))

# ==================== ChromaDB 向量数据库 ====================

# 确保 ChromaDB 目录存在
CHROMA_DIR.mkdir(exist_ok=True)
logger.info(f"ChromaDB directory: {CHROMA_DIR}, exists: {CHROMA_DIR.exists()}")

# 使用 DashScope Embedding API（兼容 OpenAI 格式）
embedder = OpenAIEmbedder(
    id=EMBEDDER_ID,
    api_key=os.environ.get("DASHSCOPE_API_KEY"),
    base_url=EMBEDDER_BASE_URL,
    dimensions=1024,  # text-embedding-v3 默认维度
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
