"""
记忆管理路由
遵循 agno 官方文档最佳实践
https://docs.agno.com/memory/working-with-memories/overview
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException

from database import db
from agno.db.schemas.memory import UserMemory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/memory", tags=["memory"])


def _serialize_memory(memory: UserMemory) -> dict:
    """将 UserMemory 对象序列化为前端可用的字典格式"""
    return memory.to_dict()


@router.get("/{user_id}")
async def get_user_memories(user_id: str):
    """
    获取用户的所有记忆
    
    使用 agno db.get_user_memories() 方法，遵循官方最佳实践
    """
    try:
        memories: List[UserMemory] = db.get_user_memories(user_id=user_id)
        serialized_memories = [_serialize_memory(m) for m in memories]
        logger.info(f"Retrieved {len(serialized_memories)} memories for user {user_id}")
        return {"user_id": user_id, "memories": serialized_memories}
    except Exception as e:
        logger.error(f"Get memories error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/{memory_id}")
async def delete_user_memory(user_id: str, memory_id: str):
    """
    删除用户特定记忆
    
    使用 agno db.delete_user_memory() 方法，确保数据一致性
    """
    try:
        # 先检查记忆是否存在且属于该用户
        existing_memory = db.get_user_memory(memory_id=memory_id, user_id=user_id)
        if existing_memory is None:
            logger.warning(f"Memory {memory_id} not found for user {user_id}")
            return {"status": "ok", "message": f"Memory {memory_id} not found", "deleted": 0}
        
        # 使用 agno db 方法删除
        db.delete_user_memory(memory_id=memory_id, user_id=user_id)
        logger.info(f"Deleted memory {memory_id} for user {user_id}")
        return {"status": "ok", "message": f"Memory {memory_id} deleted", "deleted": 1}
    except Exception as e:
        logger.error(f"Delete memory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}")
async def clear_user_memories(user_id: str):
    """
    清空用户所有记忆
    
    批量删除用户的所有记忆条目
    """
    try:
        # 先获取该用户的所有记忆 ID
        memories = db.get_user_memories(user_id=user_id)
        deleted_count = 0
        
        for memory in memories:
            try:
                db.delete_user_memory(memory_id=memory.memory_id, user_id=user_id)
                deleted_count += 1
            except Exception as e:
                logger.warning(f"Failed to delete memory {memory.memory_id}: {e}")
        
        logger.info(f"Cleared {deleted_count} memories for user {user_id}")
        return {"status": "ok", "message": "All memories cleared", "deleted": deleted_count}
    except Exception as e:
        logger.error(f"Clear memories error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/stats")
async def get_memory_stats(user_id: str):
    """
    获取用户记忆统计信息
    
    用于监控和优化记忆管理
    """
    try:
        stats, total_count = db.get_user_memory_stats(user_id=user_id)
        return {
            "user_id": user_id,
            "stats": stats,
            "total_count": total_count
        }
    except Exception as e:
        logger.error(f"Get memory stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
