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

def create_agent_for_request(user_message: str, user_id: str = "default", chat_board_mode: bool = False, session_id: Optional[str] = None) -> Agent:
    """
    Create an Agent instance for a specific request, using dynamically generated instructions.
    
    According to agno official documentation best practices:
    - update_memory_on_run=True: Enable automatic memory extraction
    - memory_manager: Custom memory management
    - add_memories_to_context=True: Automatically add memories to context
    - db / session_id: Enable persistent short-term chat history
    
    Args:
        user_message: User message for intent classification and dynamic instruction generation
        user_id: User ID
        session_id: Session ID for enabling conversational history
    
    Returns:
        Configured Agent instance
    """
    dynamic_instructions = build_dynamic_instructions(user_message, force_chatbi=chat_board_mode)
    
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
        # Multi-turn history persistence implementation via native db parameter
        session_id=session_id,
        add_history_to_context=True,  # Load conversation history from db by session_id
        
        # Memory configuration - following agno official best practices (Semantic Memories)
        update_memory_on_run=True,  # Automatically extract and save memories
        memory_manager=get_memory_manager(),  # Custom memory manager
        add_memories_to_context=True,  # Automatically inject memories into context
        
        # Knowledge base configuration
        knowledge=knowledge,
        search_knowledge=True,
        
        # Tool configuration
        tools=get_all_tools(),
        
        # Instruction configuration
        instructions=dynamic_instructions,
        user_id=user_id,
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
