"""
Custom Tool Definitions Module
"""

import os
import logging
from datetime import datetime

from agno.tools import tool
from agno.run import RunContext

from config import KNOWLEDGE_DIR

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
        logger.info(f"Search results: {results}")

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
        generate_ppt,
    ]
