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

import json
import os
from pathlib import Path

# ==================== Task Store ====================
# Simple file-backed store for course generation tasks.
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
TASKS_FILE = DATA_DIR / "course_tasks.json"

_course_tasks: Dict[str, Dict[str, Any]] = {}

def _load_tasks():
    global _course_tasks
    if TASKS_FILE.exists():
        try:
            with open(TASKS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                _course_tasks = data
        except Exception as e:
            logger.error(f"Error loading course tasks: {e}")

def _save_tasks():
    try:
        # Convert datetime objects to string for JSON serialization
        import copy
        tasks_copy = copy.deepcopy(_course_tasks)
        for t_id, task in tasks_copy.items():
            if isinstance(task.get("created_at"), datetime):
                task["created_at"] = task["created_at"].isoformat()
            if isinstance(task.get("updated_at"), datetime):
                task["updated_at"] = task["updated_at"].isoformat()
        with open(TASKS_FILE, "w", encoding="utf-8") as f:
            json.dump(tasks_copy, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving course tasks: {e}")

_load_tasks()


def create_course_task(session_id: str) -> str:
    """Create a new course generation task tracking entry."""
    task_id = str(uuid.uuid4())
    _course_tasks[task_id] = {
        "id": task_id,
        "session_id": session_id,
        "status": "generating",
        "result": None,
        "error": None,
        "is_saved": False,
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    _save_tasks()
    logger.info(f"Created course task {task_id} for session {session_id}")
    return task_id


def get_course_task(task_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a course generation task by ID."""
    return _course_tasks.get(task_id)

def get_all_course_tasks() -> list:
    """Retrieve all course generation tasks."""
    return list(_course_tasks.values())


def update_course_task(task_id: str, status: str, result: str = None, error: str = None):
    """Update a course generation task's status and result."""
    if task_id in _course_tasks:
        _course_tasks[task_id]["status"] = status
        _course_tasks[task_id]["result"] = result
        _course_tasks[task_id]["error"] = error
        _course_tasks[task_id]["updated_at"] = datetime.now()
        _save_tasks()

def delete_course_task(task_id: str):
    """Delete a course generation task."""
    if task_id in _course_tasks:
        del _course_tasks[task_id]
        _save_tasks()

def get_all_saved_courses() -> List[Dict]:
    """Return all saved courses, sorted by latest first."""
    saved = []
    for tid, task in _course_tasks.items():
        if task.get("is_saved") and task.get("status") == "completed":
            saved.append(task)
            
    def get_sort_key(task):
        val = task.get("updated_at")
        if isinstance(val, datetime):
            return val.isoformat()
        if isinstance(val, str):
            return val
        return ""

    return sorted(saved, key=get_sort_key, reverse=True)

def save_course_task(task_id: str):
    """Mark a course generation task as saved."""
    if task_id in _course_tasks:
        _course_tasks[task_id]["is_saved"] = True
        _course_tasks[task_id]["updated_at"] = datetime.now()
        _save_tasks()

# ==================== Course Agent ====================

def create_course_agent() -> Agent:
    """Create a Course Agent for generating micro-courses based on RAG context."""
    course_instructions = """
    You are a professional micro-course content designer.
    Your task is to generate a highly detailed and comprehensive micro-course document in pure Markdown format based on the user's latest question and ALL the RAG-retrieved reference materials.
    
    Crucial Instructions:
    1. Do NOT just provide a brief summary. The course MUST be significantly more detailed than a standard chatbot reply.
    2. First, internally analyze ALL the retrieved content and organize a detailed outline that covers every piece of relevant information.
    3. Then, expand this outline into a full, in-depth micro-course, ensuring you extract and explain the technical details, nuances, and step-by-step procedures thoroughly.
    4. Break the content down into logically clear and highly detailed sections using Markdown Headings (e.g., `## Section Title`).
    5. The output MUST be a pure, readable Markdown document. Do NOT output JSON.
    6. Language Adaptation: The generated micro-course MUST strictly be in the EXACT same language as the user's question. If the user asks in English, the entire course content, including all headings, must be in English. If the user asks in Chinese, it must be in Chinese.
    
    Markdown Format Structure Example:
    # Main Title of the Course
    
    ## Learning Objectives
    - Objective 1
    - Objective 2
    
    ## Section Title
    A very detailed paragraph explaining this concept comprehensively. Use **bold** text to emphasize key points.
    
    Another detailed paragraph covering steps. Insert relevant images inline where they belong.
    
    ## Another Section
    More paragraphs as needed to fully cover the retrieved materials for this section.
    
    ---
    IMPORTANT MULTIMODAL INSTRUCTION:
    If you see the tag `[系统附加信息：包含参考图片 ![参考图片](...)]` in the retrieved knowledge base chunks, you MUST include those exact Markdown image tags `![参考图片](...)` in your generated Markdown course at the relevant positions to illustrate the steps.
    DO NOT hallucinate image tags. Only use the exact images provided in the system context.
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
