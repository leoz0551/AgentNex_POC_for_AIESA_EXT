"""
Custom Tool Definitions Module
"""

import os
import logging
from datetime import datetime

from agno.tools import tool
from agno.run import RunContext

from config import KNOWLEDGE_DIR
from models_chatbi import SessionLocal, UserInfo, UserQuery, QueryContent
from tools_sandbox import execute_pandas_analysis
from data_cache import set_session_df, get_next_handle_name
import pandas as pd
from sqlalchemy import func
from typing import List, Optional

logger = logging.getLogger(__name__)

# ==================== Tavily 可用性检查 ====================

try:
    from tavily import TavilyClient
    TAVILY_AVAILABLE = True
except ImportError:
    TAVILY_AVAILABLE = False
    logger.warning("Tavily library not available. Web search functionality will be disabled.")


# ==================== 基础工具 ====================

@tool
def get_current_time() -> str:
    """Get the current local time."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool
def calculate(expression: str) -> str:
    """
    Calculate mathematical expressions.
    
    Args:
        expression: Mathematical expression, e.g., "2 + 3 * 4"
    """
    try:
        # 安全计算简单数学表达式
        allowed_chars = set("0123456789+-*/().% ")
        if not all(c in allowed_chars for c in expression):
            return "Error: Expression contains forbidden characters"
        result = eval(expression)
        return f"Calculation result: {result}"
    except Exception as e:
        return f"Calculation error: {str(e)}"


# ==================== 笔记工具 ====================

@tool
def save_note(run_context: RunContext, title: str, content: str) -> str:
    """
    Save a note to user memory.
    
    Args:
        title: Note title
        content: Note content
    """
    try:
        user_id = run_context.user_id or "default"
        note_file = KNOWLEDGE_DIR / f"note_{user_id}_{title}.txt"
        with open(note_file, "w", encoding="utf-8") as f:
            f.write(f"# {title}\n\n{content}\n\nCreated at: {datetime.now()}")
        return f"Note '{title}' saved successfully"
    except Exception as e:
        return f"Failed to save note: {str(e)}"


@tool
def search_notes(run_context: RunContext, query: str) -> str:
    """
    Search user notes.
    
    Args:
        query: Search keywords
    """
    try:
        user_id = run_context.user_id or "default"
        results = []
        for note_file in KNOWLEDGE_DIR.glob(f"note_{user_id}_*.txt"):
            with open(note_file, "r", encoding="utf-8") as f:
                content = f.read()
                if query.lower() in content.lower():
                    results.append(f"File: {note_file.name}\n{content[:200]}...")
        if results:
            return "\n\n---\n\n".join(results)
        return f"No notes found containing '{query}'"
    except Exception as e:
        return f"Search failed: {str(e)}"


# ==================== 知识库搜索工具 ====================

# 注意: knowledge 实例需要在运行时注入，避免循环导入
_knowledge_instance = None


def set_knowledge_instance(knowledge):
    """设置知识库实例（避免循环导入）"""
    global _knowledge_instance
    _knowledge_instance = knowledge


@tool
def search_knowledge_base(query: str) -> str:
    """
    Search content in the knowledge base. Use this tool when users ask questions about uploaded documents, 
    knowledge base content, or specific topics.

    Args:
        query: Search query for finding relevant content in the knowledge base
    """
    if _knowledge_instance is None:
        return "[Knowledge Base] Error: Knowledge base not initialized."
    
    try:
        logger.info(f"Searching knowledge base for: {query}")
        results = _knowledge_instance.search(query=query)
        
        # 简化日志输出，避免打印巨大的向量
        if results:
            simplified_results = []
            for r in results:
                # 提取内容预览
                content_preview = ""
                if hasattr(r, 'content'):
                    content_preview = r.content[:50]
                elif isinstance(r, dict):
                    content_preview = (r.get('content') or r.get('chunk') or "")[:50]
                
                # 提取元数据 (排除 embedding)
                meta = {}
                if hasattr(r, 'meta_data'):
                    meta = {k: v for k, v in (r.meta_data or {}).items() if k != 'embedding'}
                elif hasattr(r, 'metadata'):
                    meta = {k: v for k, v in (r.metadata or {}).items() if k != 'embedding'}
                elif isinstance(r, dict):
                    meta = {k: v for k, v in r.get('metadata', {}).items() if k != 'embedding'}
                
                simplified_results.append({"content": content_preview + "...", "metadata": meta})
            logger.info(f"Search completed: {len(results)} items found. Results snippet: {simplified_results}")
        else:
            logger.info("Search completed: No items found.")

        if not results:
            return "[Knowledge Base] No relevant content found."

        # Format search results
        formatted_results = []
        for i, result in enumerate(results, 1):
            if isinstance(result, dict):
                content = result.get("content", result.get("chunk", ""))
                source = result.get("metadata", {}).get("filename", result.get("metadata", {}).get("source", "Unknown"))
                formatted_results.append(f"[Result {i}] Source: {source}\n{content[:500]}...")
            elif hasattr(result, 'content'):
                # agno Document object
                content = result.content
                name = getattr(result, 'name', 'Unknown')
                formatted_results.append(f"[Result {i}] Source: {name}\n{content[:500]}...")
            else:
                formatted_results.append(f"[Result {i}]\n{str(result)[:500]}...")

        return f"[Knowledge Base Results] Found {len(results)} relevant items:\n\n" + "\n\n---\n\n".join(formatted_results)
    except Exception as e:
        logger.error(f"[KNOWLEDGE SEARCH] Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return "[Knowledge Base Error] Search failed. Please try again later."


# ==================== 网络搜索工具 ====================

@tool
def web_search_tavily(query: str, max_results: int = 5) -> str:
    """
    Perform a web search using the Tavily API. Use this tool when users ask questions requiring 
    latest information from the internet.
    
    Args:
        query: Search query
        max_results: Maximum number of results to return (default is 5)
    """
    if not TAVILY_AVAILABLE:
        return "[Web Search Result] Web search functionality is unavailable."
    
    try:
        # 获取 API 密钥
        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            return "[Web Search Result] Tavily API key is not configured."
        
        # 创建 Tavily 客户端
        tavily_client = TavilyClient(api_key=api_key)
        
        # 执行搜索
        logger.info(f"Performing Tavily web search for: {query}")
        response = tavily_client.search(
            query=query,
            search_depth="advanced",
            include_answer=True,
            max_results=max_results
        )
        
        # Format results
        if not response.get("results"):
            return "[Web Search Result] No relevant web search results found."
        
        # 包含 AI 生成的答案（如果有）
        answer = response.get("answer", "")
        results_text = ""
        
        if answer:
            results_text += f"**AI 总结答案**:\n{answer}\n\n"
        
        # 添加详细结果
        results_text += "**详细搜索结果**:\n"
        for i, result in enumerate(response["results"], 1):
            title = result.get("title", "无标题")
            url = result.get("url", "")
            content = result.get("content", "")[:300] + "..." if len(result.get("content", "")) > 300 else result.get("content", "")
            relevance_score = result.get("score", 0)
            
            results_text += f"\n[Result {i}] (Score: {relevance_score:.2f})\n"
            results_text += f"Title: {title}\n"
            results_text += f"URL: {url}\n"
            results_text += f"Content: {content}\n"
        
        return f"[Web Search Results] Search completed:\n\n" + results_text
        
    except Exception as e:
        logger.error(f"[TAVILY SEARCH] Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return f"[Web Search Result] Web search failed: {str(e)}"


# ==================== PPT 生成工具 ====================

@tool
def generate_ppt(topic: str) -> str:
    """
    Generate a PPT outline and download link based on the provided topic or content.
    
    Args:
        topic: The topic or main content for the PPT
    """
    try:
        logger.info(f"Generating PPT for: {topic}")
        # 模拟生成过程
        mock_download_url = "https://download.lenovo.com/pccbbs/mobiles_pdf/x250_ug_en.pdf"
        # 返回中立的格式，让 Agent 根据用户语言进行翻译和呈现
        return f"PPT_GENERATION_SUCCESS\nTopic: {topic}\nDownload Link: [Download the PPT]({mock_download_url})"
    except Exception as e:
        logger.error(f"[PPT GENERATE] Error: {e}")
        return f"PPT_GENERATION_FAILED: {str(e)}"

# ==================== ChatBI 技能库工具级 ====================

@tool
def search_glossary(query: str) -> str:
    """
    专门搜索术语库文件中的术语定义。当Agent需要理解特定指标计算公式或系统名词含义时必须先调用。
    
    Args:
        query: 术语名词或概念
    """
    try:
        glossary_path = KNOWLEDGE_DIR / "chat_dashboard_glossary.md"
        if not glossary_path.exists():
            return "【术语解释】未配置术语库。"
        with open(glossary_path, "r", encoding="utf-8") as f:
            content = f.read()
        if query.lower() in content.lower():
            # Simply return the whole context or a matched part, for POC returning all is fine if small.
            return f"【术语库参考内容】\n{content}"
        return f"【术语解释】术语库中未找到和 {query} 相关的内容。"
    except Exception as e:
        return f"读取术语库失败: {e}"

@tool
def fetch_users_data(run_context: RunContext, org_level: Optional[str] = None, org_name: Optional[str] = None, username_list: Optional[List[str]] = None) -> str:
    """
    统一的用户信息获取技能：查询 UserInfo 实体数据并保存为 'df_users' 句柄。
    
    【参数规范】：
    1. 如果想按组织架构查询，请提供 org_level ('group', 'org', 'dept', 'team') 和 org_name。
    2. username_list：如果想获取特定几个用户的信息，提供此参数。必须是真实存在的用户名，**严禁编造不存在的用户名 (例如 ["*"], ["all"])**。
    3. 如果想获取全量所有用户信息，请直接**什么参数都不传**，保留默认空参即可。
    """
    session_id = run_context.session_id or "default_session"
    logger.info(f"[SKILL] fetch_users_data started for session {session_id}.")
    
    try:
        db = SessionLocal()
        query = db.query(UserInfo)
        
        if org_level and org_name:
            if org_level == 'group': query = query.filter(UserInfo.group_name == org_name)
            elif org_level == 'org': query = query.filter(UserInfo.org_name == org_name)
            elif org_level == 'dept': query = query.filter(UserInfo.dept_name == org_name)
            elif org_level == 'team': query = query.filter(UserInfo.team_name == org_name)
            
        if username_list:
            query = query.filter(UserInfo.username.in_(username_list))
            
        df = pd.read_sql(query.statement, db.bind)
        db.close()
        
        handle_name = get_next_handle_name(session_id, "df_users")
        set_session_df(session_id, handle_name, df)
        
        logger.info(f"[SKILL] fetch_users_data completed. Found {len(df)} users.")
        return f"【数据提取成功】已获取用户数据。当前数据已存入新句柄: '{handle_name}'。包含列: {df.columns.tolist()}，共 {len(df)} 行。请在沙箱代码中使用此句柄。"
    except Exception as e:
        logger.error(f"[SKILL] fetch_users_data failed: {e}")
        return f"获取用户数据失败: {str(e)}"

@tool
def fetch_queries_data(run_context: RunContext, username_list: Optional[List[str]] = None, start_time: Optional[str] = None, end_time: Optional[str] = None) -> str:
    """
    统一的查询索引获取技能：获取轻量级的查询记录索引(仅ID、时间和用户名)，保存为 'df_queries' 句柄。
    
    【参数规范】：
    1. 你必须传入至少一个过滤条件（通常是时间范围），不得空参调用。
    2. username_list：如果不查特定用户请忽略此参数。**严禁编造诸如 ["*"], ["all"] 等不存在的用户名**，否则会导致0条结果。
    3. start_time / end_time：支持时间过滤。建议格式: '2026-02-01 00:00:00' 到 '2026-02-28 23:59:59'。如果 end_time 只传日期（如 '2026-02-28'），系统会自动补充为当天的深夜。
    
    【示例】：如果想查所有人的全局统计，请**只传时间参数**：
    fetch_queries_data(start_time="2026-02-01", end_time="2026-02-28")
    """
    session_id = run_context.session_id or "default_session"
    
    # 时间参数自动归一化：如果只传日期，为 end_time 补全 23:59:59
    if start_time and len(start_time.strip()) == 10:
        start_time = f"{start_time.strip()} 00:00:00"
    if end_time and len(end_time.strip()) == 10:
        end_time = f"{end_time.strip()} 23:59:59"
    logger.info(f"[SKILL] fetch_queries_data started for session {session_id}.")
    
    try:
        db = SessionLocal()
        # 仅查询 UserQuery 表中的元数据
        query = db.query(
            UserQuery.query_id,
            UserQuery.username, 
            UserQuery.session_id.label("user_session_id"), 
            UserQuery.q_time
        )
        
        if username_list:
            query = query.filter(UserQuery.username.in_(username_list))
        if start_time:
            query = query.filter(UserQuery.q_time >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.filter(UserQuery.q_time <= datetime.fromisoformat(end_time))
            
        df = pd.read_sql(query.statement, db.bind)
        db.close()
        
        handle_name = get_next_handle_name(session_id, "df_queries")
        set_session_df(session_id, handle_name, df)
        
        logger.info(f"[SKILL] fetch_queries_data completed. Found {len(df)} IDs. Params: start={start_time}, end={end_time}, users={username_list}")
        return f"【数据提取成功】已获取查询记录索引。当前数据已存入新句柄: '{handle_name}'。包含 {len(df)} 行记录。请在后续分析中通过 '{handle_name}' 访问此批数据。"
    except Exception as e:
        logger.error(f"[SKILL] fetch_queries_data failed: {e}")
        return f"获取查询索引失败: {str(e)}"

@tool
def fetch_query_details_data(run_context: RunContext, query_id_list: Optional[List[str]] = None, username_list: Optional[List[str]] = None, start_time: Optional[str] = None, end_time: Optional[str] = None) -> str:
    """
    统一的聊天详情获取技能：获取对话详细内容(user_query, ai_response)并保存为 'df_query_details' 句柄。
    
    【参数规范】：
    1. 你必须传入 query_id_list、username_list 或时间区间作为过滤条件，禁止无参全表扫描。
    2. username_list：仅填入真实查询提取出的用户名。不要编造通配符。
    3. query_id_list：如果想深挖某几个提问，传入此参数。请避免一次传入过多ID。大批量提取请直接用 username_list。
    4. end_time：如果只传日期，系统会自动补充为深夜时间 23:59:59。
    """
    session_id = run_context.session_id or "default_session"
    
    # 时间参数自动归一化
    if start_time and len(start_time.strip()) == 10:
        start_time = f"{start_time.strip()} 00:00:00"
    if end_time and len(end_time.strip()) == 10:
        end_time = f"{end_time.strip()} 23:59:59"
    logger.info(f"[SKILL] fetch_query_details_data started for session {session_id}.")
    
    try:
        db = SessionLocal()
        # 连表查询详细对话内容
        query = db.query(
            UserQuery.username,
            UserQuery.q_time,
            QueryContent.query_id,
            QueryContent.user_query,
            QueryContent.ai_response
        ).join(QueryContent, UserQuery.query_id == QueryContent.query_id)
        
        if query_id_list:
            query = query.filter(QueryContent.query_id.in_(query_id_list))
        if username_list:
            query = query.filter(UserQuery.username.in_(username_list))
        if start_time:
            query = query.filter(UserQuery.q_time >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.filter(UserQuery.q_time <= datetime.fromisoformat(end_time))
            
        df = pd.read_sql(query.statement, db.bind)
        db.close()
        
        handle_name = get_next_handle_name(session_id, "df_query_details")
        set_session_df(session_id, handle_name, df)
        
        logger.info(f"[SKILL] fetch_query_details_data completed. Found {len(df)} details.")
        return f"【数据提取成功】已获取详细内容。当前数据已存入新句柄: '{handle_name}'。包含列: {df.columns.tolist()}，共 {len(df)} 行。请使用 '{handle_name}' 进行分析。"
    except Exception as e:
        logger.error(f"[SKILL] fetch_query_details_data failed: {e}")
        return f"获取聊天细节失败: {str(e)}"

@tool
def fetch_sessions_data(run_context: RunContext, session_id_list: Optional[List[str]] = None, username_list: Optional[List[str]] = None, start_time: Optional[str] = None, end_time: Optional[str] = None) -> str:
    """
    统一的会话摘要获取技能：聚合会话(session)的时长和轮数信息，保存为 'df_sessions' 句柄。
    
    【参数规范】：
    1. 请必须传入过滤条件，如 start_time, end_time, session_id_list 或 username_list。
    2. username_list：必须是从数据库得来的真实用户名。严禁编造如 ["*"] 等通配符，否则报错。
    3. 如果 end_time 只传日期，内部会自动补全为 23:59:59。
    """
    session_id = run_context.session_id or "default_session"
    
    if start_time and len(start_time.strip()) == 10:
        start_time = f"{start_time.strip()} 00:00:00"
    if end_time and len(end_time.strip()) == 10:
        end_time = f"{end_time.strip()} 23:59:59"
    logger.info(f"[SKILL] fetch_sessions_data started for session {session_id}.")
    
    try:
        db = SessionLocal()
        # 聚合会话信息
        query = db.query(
            UserQuery.session_id, 
            UserQuery.username,
            func.min(UserQuery.q_time).label("start_time"),
            func.max(UserQuery.q_time).label("end_time"),
            func.count(UserQuery.query_id).label("query_count")
        ).group_by(UserQuery.session_id, UserQuery.username)
        
        if session_id_list:
            query = query.filter(UserQuery.session_id.in_(session_id_list))
        if username_list:
            query = query.filter(UserQuery.username.in_(username_list))
        if start_time:
            query = query.filter(UserQuery.q_time >= datetime.fromisoformat(start_time))
        if end_time:
            query = query.filter(UserQuery.q_time <= datetime.fromisoformat(end_time))
            
        df = pd.read_sql(query.statement, db.bind)
        db.close()
        
        handle_name = get_next_handle_name(session_id, "df_sessions")
        set_session_df(session_id, handle_name, df)
        
        logger.info(f"[SKILL] fetch_sessions_data completed. Found {len(df)} sessions.")
        return f"【数据提取成功】已获取会话摘要。当前数据已存入新句柄: '{handle_name}'。包含列: {df.columns.tolist()}，共 {len(df)} 行。请通过 '{handle_name}' 访问。"
    except Exception as e:
        logger.error(f"[SKILL] fetch_sessions_data failed: {e}")
        return f"获取会话数据失败: {str(e)}"

# ==================== Tools List ====================

def get_all_tools():
    """Get the list of all available tools"""
    return [
        get_current_time,
        calculate,
        save_note,
        search_notes,
        search_knowledge_base,
        web_search_tavily,
        search_glossary,
        fetch_users_data,
        fetch_queries_data,
        fetch_query_details_data,
        fetch_sessions_data,
        execute_pandas_analysis
    ]
