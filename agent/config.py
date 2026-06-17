"""
配置管理模块
集中管理所有配置项和环境变量
"""

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== API 密钥检查 ====================

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY")

if not OPENROUTER_API_KEY:
    logger.warning("OPENROUTER_API_KEY environment variable is not set")
if not DASHSCOPE_API_KEY:
    logger.warning("DASHSCOPE_API_KEY environment variable is not set (used for Embeddings)")

if not OPENROUTER_API_KEY and not DASHSCOPE_API_KEY:
    logger.error("At least one API Key (OpenRouter or DashScope) is required")
    raise ValueError("API Key is required")

# ==================== 路径配置 ====================


DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

PROMPTS_DIR = Path(__file__).parent / "prompts"
PROMPTS_DIR.mkdir(exist_ok=True)

DB_FILE = DATA_DIR / "agents.db"
CHROMA_DIR = DATA_DIR / "chromadb"
KNOWLEDGE_DIR = DATA_DIR / "knowledge"
KNOWLEDGE_DIR.mkdir(exist_ok=True)

DOCUMENTS_META_FILE = DATA_DIR / "documents_meta.json"

# ==================== 模型配置 ====================

MODEL_ID = "openai/gpt-4o-mini"
MODEL_BASE_URL = "https://openrouter.ai/api/v1"


# ==================== 嵌入模型配置 ====================

# OpenRouter Qwen3 Embedding (兼容 OpenAI API 格式)
EMBEDDER_ID = "qwen/qwen3-embedding-8b"
EMBEDDER_BASE_URL = "https://openrouter.ai/api/v1"
CHROMA_COLLECTION_NAME = "agentnex_knowledge"

# Cosine distance threshold for filtering knowledge base search results.
# Documents with a cosine distance greater than this threshold will be filtered out as irrelevant.
# Lower threshold means higher similarity requirement (more precise, fewer results).
# Default balanced threshold is 0.55.
KNOWLEDGE_SEARCH_DISTANCE_THRESHOLD = 0.55


# ==================== API 配置 ====================

API_TITLE = "AgentNex API"
API_VERSION = "2.1.0"
API_DESCRIPTION = "AI Agent API - 支持动态提示词管理、意图分类、会话管理、流式输出、消息反馈、工具调用、记忆、知识库"

# ==================== 多模态配置 ====================
IMAGES_DIR = DATA_DIR / "imgs"
IMAGES_DIR.mkdir(exist_ok=True)
IMAGE_META_FILE = DATA_DIR / "image_store.json"
SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
