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
    
    # PPT generation keywords
    ppt_keywords = ["ppt", "slide", "presentation", "powerpoint", "生成ppt", "制作ppt", "演示文稿", "大纲"]
    if any(kw in msg_lower for kw in ppt_keywords):
        return "ppt_generation"

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
    
    # Default to multi-layer fallback strategy
    return "fallback_strategy"


# ==================== Dynamic Instruction Building ====================

def build_dynamic_instructions(user_message: str, web_search_enabled: bool = True) -> List[str]:
    """
    Dynamically build the final system instruction list based on user message.
    
    Args:
        user_message: User's input message
        web_search_enabled: Whether web search is enabled
    
    Returns:
        Dynamically assembled instruction list
    """
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
    elif intent == "ppt_generation":
        ppt_instructions = load_prompt_template("ppt_generation")
        # For PPT generation, we also need tool use instructions
        tool_instructions = load_prompt_template("tool_use")
        instructions.extend(tool_instructions)
        instructions.extend(ppt_instructions)
        logger.info(f"Added {len(ppt_instructions)} PPT-specific instructions")
    elif intent == "fallback_strategy":
        fallback_instructions = load_prompt_template("fallback_strategy")
        instructions.extend(fallback_instructions)
        logger.info(f"Added {len(fallback_instructions)} fallback-strategy instructions")
    
    # Handle Web Search toggle constraints
    if not web_search_enabled:
        web_search_constraints = [
            "CRITICAL CONSTRAINT (WEB SEARCH):",
            "1. Web search functionality is currently DISABLED by the user.",
            "2. DO NOT attempt to use the `web_search_tavily` tool, as it has been removed from your toolset.",
            "3. If you cannot find information in the knowledge base, do NOT suggest searching the web.",
            "4. Inform the user that web search is disabled if you are unable to answer from local documents and internal knowledge."
        ]
        # Append to the beginning of specialized instructions to override fallback priorities
        instructions.extend(web_search_constraints)
        logger.info("Added web search disability constraints to instructions")

    # Append a final, forceful language consistency reminder at the very end
    # This ensures the model sees this as the most recent and authoritative instruction
    language_reminder = [
        "Language Consistency Requirement (CRITICAL):",
        "1. You MUST respond in the EXACT SAME language used by the user in their core request.",
        "2. If the user's message starts with a technical prefix (e.g., '请根据以下内容生成 PPT 大纲：') but the user's own text is in English, you MUST respond in English.",
        "3. Never switch languages midway through a conversation.",
        "4. This language rule overrides all other formatting or tool-specific instructions."
    ]
    instructions.extend(language_reminder)
    
    return instructions
