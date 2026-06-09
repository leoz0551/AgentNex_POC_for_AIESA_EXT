"""
Course 路由模块
负责微课程相关的 API 接口
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any

from typing import Optional, Any, List

from services.course_service import get_course_task, get_all_course_tasks, delete_course_task, save_course_task

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

@router.get("/list/all", response_model=List[CourseTaskResponse])
async def list_course_tasks():
    """获取所有已保存的微课程任务"""
    tasks = get_all_course_tasks()
    # 兼容老数据：如果没有is_saved字段，默认当作已保存
    return [
        CourseTaskResponse(
            id=task["id"],
            session_id=task["session_id"],
            status=task["status"],
            result=task["result"],
            error=task["error"]
        ) for task in tasks if task.get("is_saved", True)
    ]

@router.delete("/{task_id}")
async def delete_course(task_id: str):
    """删除微课程任务"""
    task = get_course_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    delete_course_task(task_id)
    return {"status": "success"}

@router.post("/{task_id}/save")
async def save_course(task_id: str):
    """保存微课程任务"""
    task = get_course_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    save_course_task(task_id)
    return {"status": "success"}
