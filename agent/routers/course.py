"""
Course 路由模块
负责微课程相关的 API 接口
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any

from services.course_service import get_course_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/course", tags=["course"])

class CourseTaskResponse(BaseModel):
    id: str
    session_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None

@router.get("/{task_id}", response_model=CourseTaskResponse)
async def get_course_task_status(task_id: str):
    """查询微课程生成任务的状态及结果"""
    task = get_course_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return CourseTaskResponse(
        id=task["id"],
        session_id=task["session_id"],
        status=task["status"],
        result=task["result"],
        error=task["error"]
    )
