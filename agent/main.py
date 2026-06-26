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
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import API_TITLE, API_VERSION, API_DESCRIPTION, PROMPTS_DIR, IMAGES_DIR
from database import knowledge
from tools import set_knowledge_instance
from routers import (
    chat_router,
    sessions_router,
    memory_router,
    knowledge_router,
    tools_router,
    data_router,
    trainer_router,
    course_router,
)
from routers.a2a import router as a2a_router
from routers.kb_evol import router as kb_evol_router
from routers.simulation import router as simulation_router
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

from fastapi.exceptions import RequestValidationError
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        body = await request.body()
        logger.error(f"[Global] Pydantic validation failed! Raw payload: {body.decode('utf-8')}")
    except Exception:
        logger.error("[Global] Pydantic validation failed! Could not read body.")
    logger.error(f"[Global] Validation error details: {exc}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# 配置 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== A2A 协议监控中间件 ====================
# 捕获所有进入 /a2a/ 的请求，记录关键请求/响应信息。
# 正常流程使用 INFO 级别，异常响应使用 WARNING/ERROR，方便持续调试。
# 此中间件为生产常驻代码，勿删除。
a2a_logger = logging.getLogger("a2a.monitor")

@app.middleware("http")
async def monitor_a2a_requests(request: Request, call_next):
    """
    A2A 协议监控中间件。
    - 记录所有 /a2a/ 请求的 Method、URL、来源 IP、Body（截断至 500 字符）
    - 记录响应状态码，非 2xx 时升级为 WARNING 并附带请求 Body 完整内容，方便追溯
    - 捕获未预期的异常，记录 ERROR 日志后继续抛出，不吞掉原始错误
    注意：await request.body() 调用后 body 已缓存至 request._body，
          FastAPI 路由处理器会走缓存，无需也不能替换 _receive（否则破坏 StreamingResponse 的断连监听）
    """
    if "/a2a/" not in str(request.url):
        return await call_next(request)

    # 读取 body，Starlette 会自动缓存至 request._body，后续 FastAPI 路由无需重读
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8", errors="replace")
    client_ip = request.headers.get("x-real-ip", request.client.host if request.client else "unknown")

    a2a_logger.info(
        f"[A2A] >>> {request.method} {request.url.path} | IP: {client_ip} | "
        f"Body({len(body_bytes)}B): {body_str[:500]}{'...' if len(body_str) > 500 else ''}"
    )

    t_start = time.monotonic()
    try:
        response = await call_next(request)
    except Exception as exc:
        a2a_logger.error(
            f"[A2A] !!! UNHANDLED EXCEPTION on {request.method} {request.url.path} | "
            f"Error: {type(exc).__name__}: {exc} | "
            f"Full Body: {body_str}",
            exc_info=True
        )
        raise

    elapsed = time.monotonic() - t_start
    if response.status_code >= 400:
        a2a_logger.warning(
            f"[A2A] <<< {response.status_code} {request.method} {request.url.path} | "
            f"耗时: {elapsed:.1f}s | Full Body: {body_str}"
        )
    else:
        a2a_logger.info(
            f"[A2A] <<< {response.status_code} {request.method} {request.url.path} | 耗时: {elapsed:.1f}s"
        )

    return response



# ==================== 注册路由 ====================

app.include_router(chat_router)
app.include_router(sessions_router)
app.include_router(memory_router)
app.include_router(knowledge_router)
app.include_router(tools_router)
app.include_router(data_router, prefix="/data", tags=["Data"])
app.include_router(kb_evol_router)
app.include_router(trainer_router)
app.include_router(course_router)
app.include_router(simulation_router)
app.include_router(a2a_router)

# ==================== 静态图片路由 ====================
from fastapi.responses import FileResponse
from pathlib import Path

@app.get("/imgs/{doc_id}/{img_name}")
async def get_image(doc_id: str, img_name: str):
    file_path = IMAGES_DIR / doc_id / img_name
    if file_path.exists():
        return FileResponse(file_path)
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail=f"Image not found on disk: {file_path}")

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
    import os
    port = int(os.environ.get("API_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
