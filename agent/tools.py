"""
自定义工具定义模块
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
    """获取当前时间"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool
def calculate(expression: str) -> str:
    """
    计算数学表达式
    
    Args:
        expression: 数学表达式，如 "2 + 3 * 4"
    """
    try:
        # 安全计算简单数学表达式
        allowed_chars = set("0123456789+-*/().% ")
        if not all(c in allowed_chars for c in expression):
            return "错误：表达式包含不允许的字符"
        result = eval(expression)
        return f"计算结果: {result}"
    except Exception as e:
        return f"计算错误: {str(e)}"


# ==================== 笔记工具 ====================

@tool
def save_note(run_context: RunContext, title: str, content: str) -> str:
    """
    保存笔记到用户记忆中
    
    Args:
        title: 笔记标题
        content: 笔记内容
    """
    try:
        user_id = run_context.user_id or "default"
        note_file = KNOWLEDGE_DIR / f"note_{user_id}_{title}.txt"
        with open(note_file, "w", encoding="utf-8") as f:
            f.write(f"# {title}\n\n{content}\n\n创建时间: {datetime.now()}")
        return f"笔记 '{title}' 已保存"
    except Exception as e:
        return f"保存笔记失败: {str(e)}"


@tool
def search_notes(run_context: RunContext, query: str) -> str:
    """
    搜索用户笔记
    
    Args:
        query: 搜索关键词
    """
    try:
        user_id = run_context.user_id or "default"
        results = []
        for note_file in KNOWLEDGE_DIR.glob(f"note_{user_id}_*.txt"):
            with open(note_file, "r", encoding="utf-8") as f:
                content = f.read()
                if query.lower() in content.lower():
                    results.append(f"文件: {note_file.name}\n{content[:200]}...")
        if results:
            return "\n\n---\n\n".join(results)
        return f"未找到包含 '{query}' 的笔记"
    except Exception as e:
        return f"搜索失败: {str(e)}"


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
    搜索知识库中的内容。当用户询问关于已上传文档、知识库或特定主题的问题时，使用此工具搜索相关内容。

    Args:
        query: 搜索查询，用于在知识库中查找相关内容
    """
    if _knowledge_instance is None:
        return "【知识库搜索结果】知识库未初始化。"
    
    try:
        logger.info(f"Searching knowledge base for: {query}")
        results = _knowledge_instance.search(query=query)
        logger.info(f"Search results: {results}")

        if not results:
            return "【知识库搜索结果】未找到相关内容。"

        # 格式化搜索结果
        formatted_results = []
        for i, result in enumerate(results, 1):
            if isinstance(result, dict):
                content = result.get("content", result.get("chunk", ""))
                source = result.get("metadata", {}).get("filename", result.get("metadata", {}).get("source", "未知来源"))
                formatted_results.append(f"【结果 {i}】来源: {source}\n{content[:500]}...")
            elif hasattr(result, 'content'):
                # agno Document 对象
                content = result.content
                name = getattr(result, 'name', '未知来源')
                formatted_results.append(f"【结果 {i}】来源: {name}\n{content[:500]}...")
            else:
                formatted_results.append(f"【结果 {i}】\n{str(result)[:500]}...")

        return f"【知识库搜索结果】找到 {len(results)} 条相关内容：\n\n" + "\n\n---\n\n".join(formatted_results)
    except Exception as e:
        logger.error(f"[KNOWLEDGE SEARCH] Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return "【知识库搜索结果】搜索失败，请稍后重试。"


# ==================== 网络搜索工具 ====================

@tool
def web_search_tavily(query: str, max_results: int = 5) -> str:
    """
    使用 Tavily API 进行网络搜索。当用户询问需要从互联网获取最新信息的问题时，使用此工具。
    
    Args:
        query: 搜索查询
        max_results: 最大返回结果数，默认为 5
    """
    if not TAVILY_AVAILABLE:
        return "【网络搜索结果】网络搜索功能不可用，请确保已安装 tavily-python 库。"
    
    try:
        # 获取 API 密钥
        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            return "【网络搜索结果】Tavily API 密钥未配置，请在 .env 文件中设置 TAVILY_API_KEY。"
        
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
        
        # 格式化结果
        if not response.get("results"):
            return "【网络搜索结果】未找到相关的网络搜索结果。"
        
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
            
            results_text += f"\n【结果 {i}】(相关性: {relevance_score:.2f})\n"
            results_text += f"标题: {title}\n"
            results_text += f"URL: {url}\n"
            results_text += f"内容: {content}\n"
        
        return f"【网络搜索结果】搜索完成：\n\n" + results_text
        
    except Exception as e:
        logger.error(f"[TAVILY SEARCH] Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return f"【网络搜索结果】网络搜索失败: {str(e)}"


# ==================== 工具列表 ====================

def get_all_tools():
    """获取所有工具列表"""
    return [
        get_current_time,
        calculate,
        save_note,
        search_notes,
        search_knowledge_base,
        web_search_tavily,
    ]
