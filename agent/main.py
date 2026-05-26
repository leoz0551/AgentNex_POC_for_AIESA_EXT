"""
AI Agent API Server
基于 FastAPI 提供 REST API 接口
使用 agno + dashscope (通义千问)

功能:
- Tools: 工具调用能力
- Memory: 用户记忆
- Knowledge: 知识库 RAG
- Database: 持久化存储

架构:
- config.py: 配置管理
- database.py: 数据库初始化
- models.py: 数据模型
- tools.py: 工具定义
- prompts.py: 提示词管理
- services/: 业务服务层
- routers/: API 路由层
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import API_TITLE, API_VERSION, API_DESCRIPTION, PROMPTS_DIR
from database import knowledge
from tools import set_knowledge_instance
from routers import (
    chat_router,
    sessions_router,
    memory_router,
    knowledge_router,
    tools_router,
)
from services.session_service import session_service

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== 初始化知识库实例 ====================

# 将 knowledge 实例注入到 tools 模块（避免循环导入）
set_knowledge_instance(knowledge)


# ==================== 生命周期管理 ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("Application starting up...")
    yield
    # 关闭时
    logger.info("Application shutdown, resources cleaned")


# ==================== FastAPI 应用 ====================

app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=API_DESCRIPTION,
    lifespan=lifespan
)

# 配置 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],  # Required for frontend JS to read this custom response header
)

# ==================== 注册路由 ====================

app.include_router(chat_router)
app.include_router(sessions_router)
app.include_router(memory_router)
app.include_router(knowledge_router)
app.include_router(tools_router)

# ==================== 根端点 ====================

@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "status": "ok",
        "message": "AgentNex API is running",
        "version": API_VERSION,
        "features": ["dynamic_prompts", "intent_classification", "tools", "memory", "knowledge", "database"],
        "sessions_count": session_service.count(),
        "prompt_templates_dir": str(PROMPTS_DIR)
    }


# ==================== 启动入口 ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
