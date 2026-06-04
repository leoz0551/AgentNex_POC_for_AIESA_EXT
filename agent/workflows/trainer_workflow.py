"""
Trainer-Course Workflow Module

Orchestrates the QA Trainer Agent and the Course Generator Agent.
- QA Agent runs first, streaming its answer to the user.
- After QA finishes, this Workflow extracts the RAG context from the Agent's
  run messages, and dispatches Course Agent in a background thread (fire-and-forget).

This keeps the router layer clean and all multi-agent coordination logic
encapsulated in a single place.
"""

import json
import logging
import threading
from typing import Iterator

from tools import _latest_rag_context

from services.trainer_service import create_trainer_agent
from services.course_service import create_course_agent, create_course_task, generate_course_sync
from services.session_service import session_service
from models import Message

logger = logging.getLogger(__name__)


class TrainerCourseWorkflow:
    """
    Workflow that coordinates QA Trainer Agent and Course Generator Agent.

    Usage (from router):
        workflow = TrainerCourseWorkflow(session_id, user_id)
        for chunk in workflow.run_stream(user_message):
            yield chunk   # SSE data
    """

    def __init__(self, session_id: str, user_id: str = "default"):
        self.session_id = session_id
        self.user_id = user_id
        # Workflow holds references to both agents
        self.qa_agent = create_trainer_agent(session_id=session_id, user_id=user_id)
        self.course_agent_factory = create_course_agent  # lazy: create only when needed

    # ==================== Public API ====================

    def run_stream(self, user_message: str) -> Iterator[str]:
        """
        Main entry point.
        Yields SSE-formatted strings for the streaming response.
        """
        try:
            # Phase 1: Run QA Agent and transparently forward stream chunks
            full_content = ""
            stream = self.qa_agent.run(
                user_message,
                user_id=self.user_id,
                session_id=self.session_id,
                stream=True
            )

            last_chunk = None
            for chunk in stream:
                last_chunk = chunk
                content = self._extract_chunk_content(chunk)
                if content:
                    full_content += content
                    yield f"data: {json.dumps({'content': content, 'done': False})}\n\n"

            # Phase 2: QA finished. Extract RAG context from Agent's run messages.
            rag_context = self._extract_rag_context(last_chunk)

            if rag_context:
                # Phase 3: RAG content found – dispatch Course Agent in background
                task_id = create_course_task(self.session_id)
                course_prompt = f"用户问题：{user_message}\n\n以下是从知识库检索到的参考资料，请据此生成微课程：\n{rag_context}"

                logger.info(f"[Workflow] Dispatching Course Agent in background thread, task_id={task_id}")
                threading.Thread(
                    target=generate_course_sync,
                    args=(task_id, course_prompt),
                    daemon=True,
                    name=f"course-gen-{task_id[:8]}"
                ).start()

                # Simple heuristic: if user message has Chinese characters, default to Chinese, else English
                import re
                has_chinese = bool(re.search(r'[\u4e00-\u9fff]', user_message))
                if has_chinese:
                    placeholder = "\n\n*[详细微课程内容正在生成中...]*"
                else:
                    placeholder = "\n\n*[Detailed micro-course content is generating...]*"
                
                full_content += placeholder
                yield f"data: {json.dumps({'content': placeholder, 'done': False})}\n\n"

                # Save AI reply to session
                ai_msg = Message(content=full_content, role="assistant", course_task_id=task_id)
                session_service.add_message(self.session_id, ai_msg)

                # Final chunk with task_id for frontend polling
                yield f"data: {json.dumps({'content': '', 'done': True, 'full_content': full_content, 'course_task_id': task_id})}\n\n"
            else:
                # No RAG content – just close the stream normally
                logger.info("[Workflow] No RAG context detected, skipping course generation.")
                # Save AI reply to session
                ai_msg = Message(content=full_content, role="assistant")
                session_service.add_message(self.session_id, ai_msg)

                yield f"data: {json.dumps({'content': '', 'done': True, 'full_content': full_content})}\n\n"

        except Exception as e:
            logger.error(f"[Workflow] Stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    # ==================== Private Helpers ====================

    @staticmethod
    def _extract_chunk_content(chunk) -> str:
        """Parse content from various chunk formats returned by agno."""
        if isinstance(chunk, str):
            return chunk
        elif isinstance(chunk, dict):
            return chunk.get("content", chunk.get("delta", ""))
        elif hasattr(chunk, "content") and chunk.content:
            return chunk.content
        elif hasattr(chunk, "delta") and chunk.delta:
            return chunk.delta
        elif hasattr(chunk, "message") and isinstance(chunk.message, str):
            return chunk.message
        return ""

    def _extract_rag_context(self, last_chunk=None) -> str:
        """
        Extract raw RAG knowledge chunks. We first check the direct cache populated by
        the search_knowledge_base tool. If not found, fallback to parsing agent messages.
        """
        # --- NEW: Direct cache extraction (100% reliable) ---
        if self.session_id in _latest_rag_context:
            cached_context = _latest_rag_context.pop(self.session_id)
            logger.info("[Workflow] Successfully extracted RAG context directly from tools cache.")
            return cached_context

        # --- Fallback: Extract from Agent's run messages ---
        rag_texts = []

        # Try multiple paths to access run messages
        messages = self._get_agent_messages(last_chunk)

        for msg in messages:
            role = getattr(msg, "role", "")
            content = getattr(msg, "content", "")
            # Agno stores tool name in various attributes depending on version
            tool_name = (
                getattr(msg, "tool_name", "")
                or getattr(msg, "name", "")
                or ""
            )

            # Match: tool response from knowledge base search
            if role == "tool" and "knowledge" in tool_name.lower():
                if content and isinstance(content, str):
                    rag_texts.append(content)
                    logger.info(f"[Workflow] Extracted RAG context from tool '{tool_name}', length={len(content)}")

        if rag_texts:
            return "\n\n---\n\n".join(rag_texts)

        # Fallback: check if knowledge content was injected into system/user messages
        for msg in messages:
            role = getattr(msg, "role", "")
            content = getattr(msg, "content", "") or ""
            if role == "tool" and "知识库搜索结果" in content:
                rag_texts.append(content)
                logger.info(f"[Workflow] Extracted RAG context via content marker, length={len(content)}")

        return "\n\n---\n\n".join(rag_texts) if rag_texts else ""

    def _get_agent_messages(self, last_chunk=None) -> list:
        """
        Retrieve the message history from the QA Agent after a run.
        Handles different agno versions and attribute names.
        """
        # Path 1: Check if the last yielded chunk is a RunResponse with messages
        if last_chunk and hasattr(last_chunk, "messages") and last_chunk.messages:
            return last_chunk.messages

        # Path 2: agent.run_response.messages (agno >= 1.x)
        if hasattr(self.qa_agent, "run_response") and self.qa_agent.run_response:
            run_resp = self.qa_agent.run_response
            if hasattr(run_resp, "messages") and run_resp.messages:
                return run_resp.messages

        # Path 3: agent.memory.get_messages() (agno / phidata standard)
        if hasattr(self.qa_agent, "memory") and self.qa_agent.memory:
            mem = self.qa_agent.memory
            if hasattr(mem, "get_messages"):
                try:
                    msgs = mem.get_messages()
                    if msgs: return msgs
                except Exception:
                    pass
            if hasattr(mem, "messages") and mem.messages:
                return mem.messages

        # Path 4: agent.messages
        if hasattr(self.qa_agent, "messages") and self.qa_agent.messages:
            return self.qa_agent.messages

        logger.warning(f"[Workflow] Could not find agent messages. Chunk type: {type(last_chunk)}")
        if hasattr(self.qa_agent, "memory"):
             logger.warning(f"[Workflow] Memory attrs: {dir(self.qa_agent.memory)}")
        return []
