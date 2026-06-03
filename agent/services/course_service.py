"""
Course Service Module
Responsible for creating Course Agents and managing course generation tasks.

This module is intentionally kept synchronous and simple.
The async orchestration is handled by the Workflow layer.
"""

import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from agno.agent import Agent
from agno.models.openai import OpenAIChat

from config import MODEL_ID, MODEL_BASE_URL, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

# ==================== Task Store ====================
# Simple in-memory store for course generation tasks.
# For production, this should be moved to a database.
_course_tasks: Dict[str, Dict[str, Any]] = {}


def create_course_task(session_id: str) -> str:
    """Create a new course generation task tracking entry."""
    task_id = str(uuid.uuid4())
    _course_tasks[task_id] = {
        "id": task_id,
        "session_id": session_id,
        "status": "generating",
        "result": None,
        "error": None,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    logger.info(f"Created course task {task_id} for session {session_id}")
    return task_id


def get_course_task(task_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a course generation task by ID."""
    return _course_tasks.get(task_id)


def update_course_task(task_id: str, status: str, result: str = None, error: str = None):
    """Update a course generation task's status and result."""
    if task_id in _course_tasks:
        _course_tasks[task_id]["status"] = status
        _course_tasks[task_id]["result"] = result
        _course_tasks[task_id]["error"] = error
        _course_tasks[task_id]["updated_at"] = datetime.now()


# ==================== Course Agent ====================

def create_course_agent() -> Agent:
    """Create a Course Agent for generating micro-courses based on RAG context."""
    course_instructions = """
    You are a professional micro-course content designer.
    Your task is to generate highly detailed and comprehensive structured JSON data for a micro-course based on the user's latest question and ALL the RAG-retrieved reference materials.
    
    Crucial Instructions:
    1. Do NOT just provide a brief summary. The course MUST be significantly more detailed than a standard chatbot reply.
    2. First, internally analyze ALL the retrieved content and organize a detailed outline that covers every piece of relevant information.
    3. Then, expand this outline into a full, in-depth micro-course, ensuring you extract and explain the technical details, nuances, and step-by-step procedures thoroughly.
    4. Break the content down into logically clear and highly detailed sections.
    5. The output MUST be in the following JSON format strictly. The format should be suitable for rendering as an HTML article with a table of contents on the right side and main content on the left.
    6. Do NOT include any extra text outside of the JSON (e.g., no markdown code blocks, output the raw JSON string directly).
    7. Language Adaptation: The generated micro-course MUST be in the EXACT same language as the user's question. If the user asks in English, the entire course content (including title, objectives, and section titles) must be in English. If the user asks in Chinese, it must be in Chinese.
    
    JSON Format:
    {
        "course_title": "The Main Title of the Course",
        "time_estimate": "Estimated time (e.g., About 20 mins)",
        "learning_objectives": [
            "Objective 1",
            "Objective 2"
        ],
        "sections": [
            {
                "section_title": "Title of this section",
                "content": [
                    "A very detailed paragraph explaining this concept comprehensively.",
                    "Another detailed paragraph covering steps, technical details, or important notes.",
                    "More paragraphs as needed to fully cover the retrieved materials for this section."
                ]
            }
        ]
    }
    """

    return Agent(
        model=OpenAIChat(
            id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            base_url=MODEL_BASE_URL,
            extra_headers={
                "HTTP-Referer": "https://github.com/LegendAgent/LegendAgent",
                "X-Title": "AgentNex POC - Course",
            }
        ),
        instructions=course_instructions,
        markdown=False,  # Output raw JSON
    )


def generate_course_sync(task_id: str, prompt: str):
    """
    Synchronous course generation.
    Designed to be called from a background thread by the Workflow layer.
    """
    logger.info(f"[CourseAgent] Starting course generation for task {task_id}")
    try:
        course_agent = create_course_agent()
        response = course_agent.run(prompt)
        ai_content = response.content if hasattr(response, 'content') else str(response)

        update_course_task(task_id, status="completed", result=ai_content)
        logger.info(f"[CourseAgent] Course generation completed for task {task_id}")

    except Exception as e:
        logger.error(f"[CourseAgent] Course generation failed for task {task_id}: {e}")
        update_course_task(task_id, status="failed", error=str(e))
