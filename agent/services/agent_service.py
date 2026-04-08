"""
Agent Service Module
Responsible for creating and managing Agent instances

Follows agno official documentation best practices:
https://docs.agno.com/memory/working-with-memories/overview
"""

import os
import logging
from typing import List, Optional

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.memory import MemoryManager
from agno.tools.memory import MemoryTools

from config import MODEL_ID, MODEL_BASE_URL, OPENROUTER_API_KEY
from database import db, knowledge
from tools import get_all_tools
from prompts import build_dynamic_instructions, get_base_instructions

logger = logging.getLogger(__name__)


# ==================== Memory Manager Configuration ====================

def create_memory_manager() -> MemoryManager:
    """
    Create a memory manager
    
    According to agno official documentation, MemoryManager can:
    - Customize models for memory creation
    - Add privacy rules and additional instructions
    - Control memory extraction methods
    
    Returns:
        Configured MemoryManager instance
    """
    return MemoryManager(
        db=db,
        # Use the same model as the main Agent for memory extraction
        model=OpenAIChat(
            id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            base_url=MODEL_BASE_URL,
            extra_headers={
                "HTTP-Referer": "https://github.com/LegendAgent/LegendAgent",
                "X-Title": "AgentNex POC",
            }
        ),
        # Additional memory extraction instructions - multilingual support
        additional_instructions="""
        Memory Extraction Guidelines:
        1. Language Adaptation:
           - Record memories in the same language as the user's conversation
           - If the user converses in Chinese, record memory content in Chinese
           - If the user converses in English, record memory content in English
           - Maintain language consistency

        2. Content Selection:
           - Save user preferences, habits, and important information
           - Do not save sensitive personal information (e.g., passwords, ID numbers)
           - Merge similar memories to avoid duplication
           - Use concise third-person descriptions

        3. Memory Format:
           - Concise and clear, summarized in one sentence
           - Preserve key information and context
        """,
    )


# Create global MemoryManager instance (avoid repeated creation)
_memory_manager: Optional[MemoryManager] = None


def get_memory_manager() -> MemoryManager:
    """Get or create MemoryManager singleton"""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = create_memory_manager()
    return _memory_manager


# ==================== Memory Tools ====================

def get_memory_tools() -> List:
    """
    Get memory tools
    
    According to agno official documentation, MemoryTools provides:
    - Explicit memory creation, retrieval, update, deletion
    - Agent can autonomously decide when to store/search memories
    - Suitable for scenarios requiring fine-grained control over memory operations
    
    Returns:
        List of MemoryTools instances
    """
    return [
        MemoryTools(
            db=db,
            enable_get_memories=True,
            enable_add_memory=True,
            enable_update_memory=True,
            enable_delete_memory=True,
            enable_analyze=True,
            enable_think=True,
        )
    ]


# ==================== Agent Creation Functions ====================

def create_agent_for_request(
    user_message: str,
    user_id: str = "default",
    session_id: Optional[str] = None,
    web_search_enabled: bool = True,
    ppt_context: Optional[str] = None,
) -> Agent:
    """
    Create an Agent instance for a specific request, using dynamically generated instructions.
    
    Args:
        user_message: User message for intent classification and dynamic instruction generation
        user_id: User ID
        session_id: Current session ID (for history persistence)
        web_search_enabled: Whether to enable web search tool
        ppt_context: If set, the previous PPT outline is injected into the system prompt
                     as a locked structure that the model must preserve.
    
    Returns:
        Configured Agent instance
    """
    # When a saved PPT outline is present, bypass the standard intent flow entirely.
    # The standard ppt_generation.md mandates a full KB search, which causes the model
    # to replace the entire outline with fresh KB results. Instead, we use a targeted
    # "PPT EDIT MODE" that restricts KB search to only the new content being added.
    if ppt_context:
        logger.info(f"Entering PPT EDIT MODE: overriding standard intent flow with targeted editing instructions.")
        ppt_edit_instructions = get_base_instructions() + [
            "",
            "## PPT MODIFICATION MODE (CURRENTLY ACTIVE)",
            "The user wants to modify an EXISTING PPT outline. Follow these rules STRICTLY:",
            "",
            "### Your Steps:",
            "1. READ the LOCKED PPT OUTLINE below completely and carefully.",
            "2. IDENTIFY exactly what the user wants to change (e.g., add slide 4, replace slide 2).",
            "3. SEARCH (only if needed): If the requested change requires new specific information",
            "   (e.g., 'add a slide about Lenovo company history'), use search_knowledge_base or",
            "   web_search_tavily ONLY for that new information. Do NOT re-search for existing slides.",
            "4. CONSTRUCT the COMPLETE new outline:",
            "   - Copy ALL existing slides exactly as they appear in the LOCKED OUTLINE below",
            "   - Add/Replace ONLY the slide(s) the user explicitly specified",
            "5. CALL generate_ppt(topic) to produce a new download link.",
            "6. OUTPUT the full modified outline, then references, then the download link.",
            "",
            "### CRITICAL RULES:",
            "- NEVER regenerate slides that are NOT mentioned in the user's request.",
            "- NEVER use KB search results to replace or 'improve' existing slides.",
            "- The existing slides are FINAL. Only the specifically requested slide changes.",
            "",
            "=" * 60,
            "LOCKED PPT OUTLINE (COPY THESE SLIDES AS-IS INTO YOUR OUTPUT):",
            "=" * 60,
            ppt_context[:4000],
            "=" * 60,
            "END OF LOCKED PPT OUTLINE",
            "=" * 60,
            "",
            "### Output Format Rules (MUST FOLLOW):",
            "- Step 5 is MANDATORY: You MUST call the generate_ppt(topic) tool to get the real download link.",
            "- After calling the tool, use the EXACT link returned by the tool as your download link.",
            "- The download link MUST be the VERY LAST line of your response. Nothing after it.",
            "- DO NOT write placeholder text like '下载链接正在生成中' or 'generating download link'.",
            "- DO NOT write any closing remarks, tips, or summaries after the download link.",
            "",
            "Language Consistency Requirement (CRITICAL):",
            "1. You MUST respond in the EXACT SAME language used by the user in their core request.",
            "2. Never switch languages midway through a conversation.",
            "3. This language rule overrides all other instructions.",
        ]
        dynamic_instructions = ppt_edit_instructions
    else:
        # Standard flow: classify intent and build instructions normally
        dynamic_instructions = build_dynamic_instructions(user_message, web_search_enabled)

    # 获取所有工具并根据开关过滤
    available_tools = get_all_tools()
    if not web_search_enabled:
        # 导入工具对象进行直接比对，避免装饰器包装后的对象缺少 __name__ 属性
        from tools import web_search_tavily
        available_tools = [t for t in available_tools if t != web_search_tavily]
        logger.info(f"Web search is disabled for user {user_id}. Tool 'web_search_tavily' removed.")
    
    return Agent(
        model=OpenAIChat(
            id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            base_url=MODEL_BASE_URL,
            extra_headers={
                "HTTP-Referer": "https://github.com/LegendAgent/LegendAgent",
                "X-Title": "AgentNex POC",
            }
        ),
        markdown=True,
        db=db,
        # Memory configuration - following agno official best practices
        update_memory_on_run=True,  # Automatically extract and save memories
        memory_manager=get_memory_manager(),  # Custom memory manager
        add_memories_to_context=True,  # Automatically inject memories into context
        add_history_to_context=True,  # Load conversation history from db by session_id
        # Knowledge base configuration
        knowledge=knowledge,
        search_knowledge=True,
        # Tool configuration
        tools=available_tools,
        # Instruction configuration
        instructions=dynamic_instructions,
        user_id=user_id,
        session_id=session_id,
    )


def create_base_agent(user_id: str = "default") -> Agent:
    """
    Create an Agent instance using base instructions (for memory management and other scenarios that don't require intent classification)
    
    This Agent does not enable automatic memory updates, used for read-only scenarios
    
    Args:
        user_id: User ID
    
    Returns:
        Configured Agent instance
    """
    base_instructions = get_base_instructions()
    
    return Agent(
        model=OpenAIChat(
            id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            base_url=MODEL_BASE_URL,
            extra_headers={
                "HTTP-Referer": "https://github.com/LegendAgent/LegendAgent",
                "X-Title": "AgentNex POC",
            }
        ),
        markdown=True,
        db=db,
        user_id=user_id,
        instructions=base_instructions,
        # Do not enable automatic memory updates, for read-only scenarios
        update_memory_on_run=False,
    )


def create_agent_with_memory_tools(user_id: str = "default") -> Agent:
    """
    Create an Agent instance with explicit memory tools
    
    According to agno official documentation, suitable for:
    - When Agent needs to autonomously decide when to store memories
    - When fine-grained control over memory operations is needed (create, update, delete)
    - When explicit memory search is needed instead of automatic loading
    
    Args:
        user_id: User ID
    
    Returns:
        Configured Agent instance
    """
    base_instructions = get_base_instructions()
    
    return Agent(
        model=OpenAIChat(
            id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            base_url=MODEL_BASE_URL,
            extra_headers={
                "HTTP-Referer": "https://github.com/LegendAgent/LegendAgent",
                "X-Title": "AgentNex POC",
            }
        ),
        markdown=True,
        db=db,
        user_id=user_id,
        instructions=base_instructions,
        # Use explicit memory tools instead of automatic memory
        tools=get_memory_tools(),
        # Disable automatic memory, let Agent manage autonomously through tools
        update_memory_on_run=False,
        add_memories_to_context=False,
    )
