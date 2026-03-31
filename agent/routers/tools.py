"""
工具接口路由
"""

from fastapi import APIRouter

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("")
async def list_tools():
    """
    列出用户可选的工具
    
    注意：内部工具（如知识库搜索、笔记管理等）由 Agent 自动调用，不在此展示
    """
    tools_list = [
        {
            "name": "web_search",
            "display_name": "联网搜索",
            "description": "使用 WebSearch 搜索引擎获取互联网最新信息",
            "icon": "Globe",
            "enabled": True,
        }
    ]
    return {"tools": tools_list}
