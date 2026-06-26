import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.responses import StreamingResponse

from models_a2a import A2ARequest, A2AResponse, A2AResponseResult
from models import Message
from services.session_service import session_service
from workflows.trainer_workflow import TrainerCourseWorkflow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/a2a", tags=["a2a"])

API_KEY_NAME = "Authorization"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def verify_api_key(api_key: str = Security(api_key_header)):
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key is missing")
    token = api_key.replace("Bearer ", "").strip()
    if token != "tk-fdaoa8x9m2q5j1s3b7v4c6n8z9m0w2p5l7k4j1h8g6f3d2s":
        raise HTTPException(status_code=403, detail="Invalid API Key")
    return token

@router.get("/.well-known/agent.json")
async def get_agent_card():
    """Agent card endpoint for Copilot Studio to discover the agent (A2A protocol spec)."""
    return {
        "name": "AI Trainer Agent",
        "description": "An AI Trainer agent capable of guiding users through courses and providing training assistance.",
        "url": "https://agentnex.cc/a2a/trainer/v1/message:stream",
        "version": "1.0",
        "capabilities": {
            "streaming": True,
            "pushNotifications": False,
            "stateTransitionHistory": False
        },
        "defaultInputModes": ["text"],
        "defaultOutputModes": ["text"],
        "skills": [
            {
                "id": "ai-trainer-guidance",
                "name": "AI Training Guidance",
                "description": "Provides detailed training guidance, step-by-step instructions, and answers questions about courses and learning materials."
            }
        ]
    }

@router.post("/trainer/{version}/message:stream")
async def a2a_trainer_stream(version: str, request: A2ARequest, api_key: str = Depends(verify_api_key)):
    """Handle A2A chat requests over HTTP with streaming response (JSON-RPC over SSE)."""
    
    if request.method != "message/send":
        raise HTTPException(status_code=400, detail="Unsupported method. Expected 'message/send'")

    message_params = request.params.message
    session_id = message_params.contextId
    
    # Extract the user's latest query
    user_message_text = ""
    
    # 优先从 parts 提取 (这是 Copilot Studio 分发给子 Agent 的真实指令)
    if message_params.parts:
        for part in message_params.parts:
            if part.kind == "text":
                user_message_text = part.text
                break
                
    if not user_message_text and message_params.metadata and message_params.metadata.chathistory:
        # Fallback: parse chathistory which might be wrapped in {"HasValue": true, "Value": [...]}
        history_list = message_params.metadata.chathistory
        if isinstance(history_list, list) and len(history_list) > 0:
            first_item = history_list[0]
            if isinstance(first_item, dict) and "Value" in first_item:
                real_history = first_item["Value"]
            else:
                real_history = history_list
                
            for msg in reversed(real_history):
                # Sometimes From is "" for the user, or "user"
                sender = msg.get("From", "").lower()
                if sender == "user" or sender == "":
                    user_message_text = msg.get("Text", "")
                    break
                
    if not user_message_text:
        # Fallback if there is no chathistory or no user message
        logger.warning(f"[A2A] No user message found in chathistory. Raw payload: {request.model_dump_json()}")
        raise HTTPException(status_code=400, detail="No user message found in chathistory")

    user_id = "a2a_user" # We could extract user info if provided in metadata
    logger.info(f"[A2A] Processing message for session {session_id}: {user_message_text}")

    session = session_service.get_or_create(session_id)
    session.user_id = user_id

    # Save user message to session
    user_msg = Message(content=user_message_text, role="user")
    session_service.add_message(session.id, user_msg)

    workflow = TrainerCourseWorkflow(session_id=session.id, user_id=user_id)
    original_req_id = request.id or "1"

    async def a2a_stream_generator():
        import asyncio
        import threading
        import time as _time

        stream_start = _time.monotonic()
        chunk_count = 0
        heartbeat_count = 0

        try:
            # ── 1. 立即发送 ack，建立连接并重置客户端超时计时器 ──────────────
            ack_event = A2AResponse(
                jsonrpc="2.0",
                id=original_req_id,
                result=A2AResponseResult(
                    type="MessageChunkEvent",
                    content=""
                )
            )
            yield f"data: {ack_event.model_dump_json(exclude_none=True)}\n\n"
            logger.info(f"[A2A] Ack sent | session: {session_id[:8]}")

            # ── 1b. 立即发送一条含文字的"思考中"提示 ─────────────────────────
            # Copilot Studio 的超时窗口很短，空 content 的 ack 不会重置其计时器。
            # 必须立刻发一条有实际文字内容的事件，让 Copilot Studio 认为流已激活。
            
            # 简单检测语言：如果包含中文字符，则用中文回复，否则用英文
            import re
            is_chinese = bool(re.search(r'[\u4e00-\u9fff]', user_message_text))
            thinking_text = "正在为您查找相关资料，请稍候…" if is_chinese else "Looking up relevant information, please wait..."
            
            thinking_event = A2AResponse(
                jsonrpc="2.0",
                id=original_req_id,
                result=A2AResponseResult(
                    type="MessageChunkEvent",
                    content=thinking_text
                )
            )
            yield f"data: {thinking_event.model_dump_json(exclude_none=True)}\n\n"
            logger.info(f"[A2A] Thinking prompt sent ({'ZH' if is_chinese else 'EN'}) | session: {session_id[:8]}")


            # ── 2. 启动生产者线程（同步模型推理 → 异步队列）─────────────────
            queue = asyncio.Queue()
            loop = asyncio.get_running_loop()

            def producer():
                try:
                    for chunk in workflow.run_stream(user_message_text):
                        raw_chunk = chunk
                        if chunk.startswith("data: "):
                            raw_chunk = chunk[6:]
                        raw_chunk = raw_chunk.strip()
                        if not raw_chunk:
                            continue
                        loop.call_soon_threadsafe(queue.put_nowait, raw_chunk)
                    loop.call_soon_threadsafe(queue.put_nowait, None)  # EOF
                except Exception as e:
                    loop.call_soon_threadsafe(queue.put_nowait, e)

            threading.Thread(
                target=producer, daemon=True, name=f"a2a-stream-{session_id[:8]}"
            ).start()

            # ── 3. 消费队列，转发 SSE chunk；超时则发心跳 ───────────────────
            while True:
                try:
                    raw_chunk = await asyncio.wait_for(queue.get(), timeout=5.0)

                    if raw_chunk is None:
                        break  # EOF

                    if isinstance(raw_chunk, Exception):
                        raise raw_chunk

                    try:
                        data_dict = json.loads(raw_chunk)
                        content_str = data_dict.get("content", "")
                    except json.JSONDecodeError:
                        content_str = raw_chunk

                    response_obj = A2AResponse(
                        jsonrpc="2.0",
                        id=original_req_id,
                        result=A2AResponseResult(
                            type="MessageChunkEvent",
                            content=content_str
                        )
                    )
                    yield f"data: {response_obj.model_dump_json(exclude_none=True)}\n\n"
                    chunk_count += 1
                    if chunk_count == 1:
                        logger.info(f"[A2A] First chunk sent | session: {session_id[:8]}")

                except asyncio.TimeoutError:
                    # 模型超过 5 秒无输出，发心跳防止连接被远端关闭
                    heartbeat_event = A2AResponse(
                        jsonrpc="2.0",
                        id=original_req_id,
                        result=A2AResponseResult(
                            type="MessageChunkEvent",
                            content=""
                        )
                    )
                    yield f"data: {heartbeat_event.model_dump_json(exclude_none=True)}\n\n"
                    heartbeat_count += 1
                    logger.debug(f"[A2A] Heartbeat #{heartbeat_count} | session: {session_id[:8]}")

            # ── 4. 发送完成事件 ──────────────────────────────────────────────
            complete_event = A2AResponse(
                jsonrpc="2.0",
                id=original_req_id,
                result=A2AResponseResult(
                    type="MessageCompleteEvent",
                    content=""
                )
            )
            yield f"data: {complete_event.model_dump_json(exclude_none=True)}\n\n"
            elapsed = _time.monotonic() - stream_start
            logger.info(
                f"[A2A] Stream completed | session: {session_id[:8]} | "
                f"chunks: {chunk_count} | heartbeats: {heartbeat_count} | elapsed: {elapsed:.1f}s"
            )

        except GeneratorExit:
            elapsed = _time.monotonic() - stream_start
            logger.warning(
                f"[A2A] Stream interrupted by client | session: {session_id[:8]} | "
                f"chunks: {chunk_count} | heartbeats: {heartbeat_count} | elapsed: {elapsed:.1f}s"
            )
            raise

        except Exception as e:
            elapsed = _time.monotonic() - stream_start
            logger.error(
                f"[A2A] Stream error | session: {session_id[:8]} | "
                f"chunks: {chunk_count} | heartbeats: {heartbeat_count} | elapsed: {elapsed:.1f}s | "
                f"error: {e}"
            )
            error_event = A2AResponse(
                jsonrpc="2.0",
                id=original_req_id,
                result=A2AResponseResult(
                    type="MessageCompleteEvent",
                    status="failed",
                    content=str(e)
                )
            )
            yield f"data: {error_event.model_dump_json(exclude_none=True)}\n\n"


    return StreamingResponse(
        a2a_stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Session-Id": session.id
        }
    )
