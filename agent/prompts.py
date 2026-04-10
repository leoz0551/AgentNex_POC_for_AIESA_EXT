"""
Prompt management and intent classification module
"""

import logging
from typing import List

from config import PROMPTS_DIR

logger = logging.getLogger(__name__)


# ==================== Prompt Loading ====================

def load_prompt_template(template_name: str) -> List[str]:
    """
    Load a prompt template file by name.
    
    Args:
        template_name: Template file name (without .md extension), e.g., "base_system"
    
    Returns:
        Parsed list of instructions
    """
    prompt_file = PROMPTS_DIR / f"{template_name}.md"
    if not prompt_file.exists():
        logger.warning(f"Prompt template file not found: {prompt_file}")
        return []
    
    with open(prompt_file, "r", encoding="utf-8") as f:
        content = f.read()
    
    lines = content.split('\n')
    instructions = []
    for line in lines:
        line = line.strip()
        if line and not line.startswith('#'):
            if line.startswith('- '):
                line = line[2:]
            elif line.startswith('* '):
                line = line[2:]
            instructions.append(line)
    
    logger.debug(f"Loaded {len(instructions)} instructions from {prompt_file}")
    return instructions


def get_base_instructions() -> List[str]:
    """
    Get base system instructions for scenarios that don't require complex intent classification (e.g., memory management)
    """
    return load_prompt_template("base_system")


# ==================== Intent Classification ====================

def classify_intent(user_message: str) -> str:
    """
    Simple intent classifier that determines the user's intent based on the message.
    
    Args:
        user_message: User's input message
    
    Returns:
        Intent type, such as "knowledge_search", "tool_use", "general_chat", "fallback_strategy"
    """
    msg_lower = user_message.lower()
    
    # Knowledge base query keywords
    knowledge_keywords = ["knowledge base", "document", "uploaded", "file", "content", "information", "rag", "vector",
                          "知识库", "文档", "上传", "资料", "根据", "文件", "内容", "信息"]
    if any(kw in msg_lower for kw in knowledge_keywords):
        return "knowledge_search"
    
    # Tool calling keywords (including web search)
    tool_keywords = ["calculate", "time", "note", "save", "search", "math", "web", "internet", "online", "latest", "news", "google", "bing", "find", "query",
                     "计算", "等于", "时间", "几点", "笔记", "保存", "搜索", "数学", "算一下", "网络", "互联网", "在线", "最新", "新闻", "百度", "必应", "查找", "查询"]
    if any(kw in msg_lower for kw in tool_keywords):
        return "tool_use"
    
    # ChatBI keywords
    chatbi_keywords = ["统计", "分析", "报表", "趋势", "访问", "数据", "表格", "图表", "echarts", "chart", "table", "analyze", "statistics", "trend"]
    if any(kw in msg_lower for kw in chatbi_keywords):
        return "chatbi_strategy"

    # Default to multi-layer fallback strategy
    return "fallback_strategy"


# ==================== Dynamic Instruction Building ====================

def build_dynamic_instructions(user_message: str, force_chatbi: bool = False) -> List[str]:
    """
    Dynamically build the final system instruction list based on user message.
    
    Args:
        user_message: User's input message
        force_chatbi: Whether to force the ChatBI strategy
    
    Returns:
        Dynamically assembled instruction list
    """
    if force_chatbi:
        intent = "chatbi_strategy"
        logger.info(f"ChatBoard mode ACTIVE: Forcing intent to {intent}")
    else:
        intent = classify_intent(user_message)
        logger.info(f"Classified intent for message '{user_message[:30]}...': {intent}")
    
    # Always load base system instructions
    instructions = load_prompt_template("base_system")
    
    # Load specific instructions based on intent
    if intent == "knowledge_search":
        knowledge_instructions = load_prompt_template("knowledge_query")
        instructions.extend(knowledge_instructions)
        logger.info(f"Added {len(knowledge_instructions)} knowledge-specific instructions")
    elif intent == "tool_use":
        tool_instructions = load_prompt_template("tool_use")
        instructions.extend(tool_instructions)
        logger.info(f"Added {len(tool_instructions)} tool-specific instructions")
    elif intent == "fallback_strategy":
        fallback_instructions = load_prompt_template("fallback_strategy")
        instructions.extend(fallback_instructions)
        logger.info(f"Added {len(fallback_instructions)} fallback-strategy instructions")
    elif intent == "chatbi_strategy":
        chatbi_instructions = load_prompt_template("chatbi_strategy")
        instructions.extend(chatbi_instructions)
        logger.info(f"Added {len(chatbi_instructions)} chatbi-strategy instructions")
    
    # If no instructions were loaded, fall back to default instructions
    if not instructions:
        logger.warning("No instructions loaded from templates, falling back to default.")
        instructions = [
            "You are an intelligent assistant that can help users complete various tasks.",
            "You can use tools to get time, perform calculations, save and search notes.",
            "When users ask questions about uploaded documents, knowledge base content, or specific topics, be sure to use the search_knowledge_base tool to search the knowledge base.",
            "If the user mentions a knowledge base or uploaded files, be sure to search the knowledge base first before answering.",
            "If the user's question involves knowledge base content, please search the knowledge base.",
            "Remember user preferences and important information for use in subsequent conversations.",
            "Always communicate in the same language as the user. If the user asks in English, you must answer in English; if the user asks in Chinese, you must answer in Chinese. Maintain language consistency throughout the conversation, do not switch languages midway.",
        ]
    
    return instructions
