import logging
import pandas as pd
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# 全局内存缓存：session_id -> { handle_name: DataFrame }
# 注意：POC环境下使用全局变量，生产环境需考虑分布式存储或清理逻辑
_SESSION_DF_CACHE: Dict[str, Dict[str, pd.DataFrame]] = {}

def set_session_df(session_id: str, handle_name: str, df: pd.DataFrame):
    """保存 DataFrame 到会话缓存"""
    if session_id not in _SESSION_DF_CACHE:
        _SESSION_DF_CACHE[session_id] = {}
    
    _SESSION_DF_CACHE[session_id][handle_name] = df
    logger.info(f"[DATA_CACHE] Saved DataFrame '{handle_name}' to session '{session_id}'. Shape: {df.shape}")

def get_session_dfs(session_id: str) -> Dict[str, pd.DataFrame]:
    """获取会话下的所有 DataFrame 句柄"""
    return _SESSION_DF_CACHE.get(session_id, {})

def get_next_handle_name(session_id: str, base_prefix: str) -> str:
    """
    方案 2 实现：生成下一个不重复的句柄名称。
    从 1 开始编号：df_queries_1, df_queries_2, df_queries_3...
    """
    handles = get_session_dfs(session_id)
    
    idx = 1
    while f"{base_prefix}_{idx}" in handles:
        idx += 1
    return f"{base_prefix}_{idx}"

def clear_session_cache(session_id: str):
    """清除会话缓存"""
    if session_id in _SESSION_DF_CACHE:
        del _SESSION_DF_CACHE[session_id]
        logger.info(f"[DATA_CACHE] Cleared cache for session '{session_id}'")
