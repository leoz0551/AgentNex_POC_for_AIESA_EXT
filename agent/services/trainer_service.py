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
    # Load strict non-conflicting prompts
    instructions = load_prompt_template("ai_trainer")
    logger.info(f"AI Trainer RAG Agent initialized. Loaded {len(instructions)} training instructions.")

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
        search_knowledge=True,
        
        # Physically stripped tools (No web search / No calculator)
        tools=[],
        
        instructions=instructions,
        system_message_role="user",
        user_id=user_id,
    )
