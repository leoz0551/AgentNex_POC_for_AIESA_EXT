"""
AI Trainer Agent Service Module
Perfectly isolated from the main chatbot services, following the kb_evol_service design pattern.
"""

import logging
from typing import Optional

from agno.agent import Agent
from agno.models.openai import OpenAIChat

from config import MODEL_ID, MODEL_BASE_URL, OPENROUTER_API_KEY
from database import db, knowledge
from tools import search_knowledge_base
from prompts import load_prompt_template
from services.agent_service import get_memory_manager

logger = logging.getLogger(__name__)


def create_trainer_agent(session_id: Optional[str] = None, user_id: str = "default") -> Agent:
    """
    Instantiate and configure the dedicated AI Trainer RAG Agent.
    
    This agent is 100% decoupled from standard chatbot systems. It loads ONLY the
    ai_trainer system prompt template, has restricted toolsets, and targets the CS
    training domain.
    """
    # Load the ai_trainer.md prompt as a single multi-line string to preserve
    # its full Markdown structure, headers, and bullet hierarchy.
    from config import PROMPTS_DIR
    prompt_file = PROMPTS_DIR / "ai_trainer.md"
    try:
        with open(prompt_file, "r", encoding="utf-8") as f:
            instructions = [f.read()]
            
        # Add Multimodal Instructions to the Trainer
        multimodal_rules = """
---
IMPORTANT MULTIMODAL INSTRUCTION:
If you see the tag `[系统附加信息：该内容段落关联以下参考图片标签，回答时请依据上下文直接使用：<Desc>...</Desc>]` in the retrieved knowledge base chunks, you MUST use the exact <Desc>...</Desc> format to reference those images in your response.
DO NOT wrap the `<Desc>` tags in Markdown image syntax (e.g., do NOT output `![alt](<Desc>...</Desc>)`). Just output the `<Desc>...</Desc>` tag directly in the text.
DO NOT hallucinate image tags. If no `<Desc>` tags are provided in the system context, do NOT output any.
ONLY use the exact <Desc>...</Desc> tags provided in the context to show images to the user.
"""
        instructions.append(multimodal_rules)
        logger.info("AI Trainer RAG Agent initialized. Loaded unified Markdown system prompt with Multimodal rules.")
    except Exception as e:
        logger.error(f"Failed to load ai_trainer system prompt: {e}")
        instructions = ["You are the AI Trainer Agent, a professional customer service training assistant."]

    return Agent(
        model=OpenAIChat(
            id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            base_url=MODEL_BASE_URL,
            extra_headers={
                "HTTP-Referer": "https://github.com/LegendAgent/LegendAgent",
                "X-Title": "AgentNex Trainer",
            }
        ),
        markdown=True,
        db=db,
        session_id=session_id,
        add_history_to_context=True,
        
        # Memory configuration (reusing the global manager from agent_service to sync preferences)
        update_memory_on_run=True,
        memory_manager=get_memory_manager(),
        add_memories_to_context=True,
        
        # Dedicated RAG knowledge base configuration
        knowledge=knowledge,
        search_knowledge=False,  # Disable native search tool to avoid duplicate tools & LLM confusion
        
        # Physically stripped tools (No web search / No calculator)
        tools=[search_knowledge_base],
        
        instructions=instructions,
        user_id=user_id,
    )
