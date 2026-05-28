import os
import json
import logging
import uuid
from typing import List
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.tavily import TavilyTools

from config import MODEL_ID, MODEL_BASE_URL, OPENROUTER_API_KEY
from models_kb_evol import SessionLocal, KBEvolTask, AgentLog

logger = logging.getLogger(__name__)

# ==================== Pydantic Schemas for Structured Output ====================

class EvaluationOutput(BaseModel):
    final_result: str = Field(
        ..., 
        description="Must be exactly one of: 'Success', 'Failed', 'Aborted', 'Escalated'"
    )
    title: str = Field(..., description="Concise title of the conversation or issue")
    desc: str = Field(..., description="A short description of the conversation's final state or failure")
    failure_point: str = Field(
        ..., 
        description="For non-Success outcomes, identify the main failure point, issue, and which part of the communication/dialogue was problematic. For Success outcomes, summarize the key solution."
    )

class GapAnalysisOutput(BaseModel):
    root_cause: str = Field(
        ..., 
        description="Must be exactly one of: 'Knowledge Lack', 'Search Mismatch', or 'Context Misunderstanding'"
    )
    gap_desc: str = Field(
        ..., 
        description="Detailed description of the missing information or why the vector search failed"
    )
    search_queries: List[str] = Field(
        ..., 
        description="List of targeted search queries to find the missing information"
    )
    optimized_entries: str = Field(
        ..., 
        description="Specification of which knowledge base entries need to be added, modified, or re-indexed, and why"
    )

class GenerationOutput(BaseModel):
    standardized_problem: str = Field(
        ..., 
        description="Standardized problem description from the user's perspective"
    )
    accurate_answer: str = Field(
        ..., 
        description="Accurate and complete troubleshooting answer/steps resolving the issue"
    )
    keyword_tags: List[str] = Field(
        ..., 
        description="Keyword tags used for search retrieval optimization"
    )
    applicable_scenario: str = Field(
        ..., 
        description="Applicable scenario and environment description"
    )
    source: str = Field(..., description="The web source or official references used to generate this knowledge")
    confidence_score: float = Field(..., description="Confidence score between 0.0 and 1.0 based on source verification")
    problems: str = Field(
        ..., 
        description="If confidence score is lower than 0.7, explain why and document the issues/reliability concerns. Otherwise, output 'None'"
    )


# ==================== Agent Instances ====================

def get_base_model():
    return OpenAIChat(
        id=MODEL_ID,
        api_key=OPENROUTER_API_KEY,
        base_url=MODEL_BASE_URL,
        extra_headers={
            "HTTP-Referer": "https://github.com/LegendAgent/LegendAgent",
            "X-Title": "AgentNex KBEvol",
        }
    )

evaluator_agent = Agent(
    model=get_base_model(),
    description="You are a professional conversation quality assessment expert. You MUST reply with a valid JSON object only.",
    instructions=[
        "You are a professional conversation quality assessment expert analyzing AI customer service call logs.",
        "",
        "## CRITICAL OUTPUT RULE",
        "You MUST output ONLY a valid JSON object. No explanations, no markdown, no text before or after the JSON.",
        "",
        "## Output Schema",
        "{",
        "  \"final_result\": \"<MUST be exactly one of: Success, Failed, Aborted, Escalated>\",",
        "  \"title\": \"<Concise title, max 10 words>\",",
        "  \"desc\": \"<One sentence description of what happened>\",",
        "  \"failure_point\": \"<For non-Success: which part of dialogue failed and why. For Success: the key solution used.>\"",
        "}",
        "",
        "## final_result Values (choose EXACTLY one word):",
        "- Success: Issue is fully resolved, customer is satisfied",
        "- Failed: AI could not resolve the issue, customer got no help",
        "- Aborted: Customer gave up or dialogue terminated abnormally",
        "- Escalated: Case was transferred to human specialist",
        "",
        "## Few-Shot Example",
        "Input: [Customer: My laptop won't boot.] [AI: Have you tried a hard reset?] [Customer: Yes still broken.] [AI: I cannot help further, escalating to specialist.]",
        "Output:",
        "{",
        "  \"final_result\": \"Escalated\",",
        "  \"title\": \"Laptop Boot Failure Escalated to Human\",",
        "  \"desc\": \"AI could not diagnose the boot failure and transferred the case to a human specialist.\",",
        "  \"failure_point\": \"At the second customer turn, AI exhausted its troubleshooting options and escalated.\"",
        "}"
    ],
    output_schema=EvaluationOutput
)

gap_analyzer_agent = Agent(
    model=get_base_model(),
    description="You are a knowledge base gap diagnosis expert. You MUST reply with a valid JSON object only.",
    instructions=[
        "You are a knowledge base gap diagnosis expert identifying root causes of unsuccessful AI customer service conversations.",
        "",
        "## CRITICAL OUTPUT RULE",
        "You MUST output ONLY a valid JSON object. No explanations, no markdown, no text before or after the JSON.",
        "",
        "## Output Schema",
        "{",
        "  \"root_cause\": \"<MUST be exactly one of: Knowledge Lack, Search Mismatch, Context Misunderstanding>\",",
        "  \"gap_desc\": \"<Detailed description of the specific gap or failure>\",",
        "  \"search_queries\": [\"<query 1>\", \"<query 2>\", \"<query 3>\"],",
        "  \"optimized_entries\": \"<Which entries to add, modify, or re-index and why>\"",
        "}",
        "",
        "## root_cause Values (choose EXACTLY one):",
        "- Knowledge Lack: The answer does not exist in the knowledge base at all",
        "- Search Mismatch: Answer exists but was not retrieved due to keyword/semantic deviation",
        "- Context Misunderstanding: User intent was misunderstood or problem was incorrectly scoped"
    ],
    output_schema=GapAnalysisOutput
)

# Initialize TavilyTools if key is available
tavily_tools = []
if os.environ.get("TAVILY_API_KEY"):
    tavily_tools.append(TavilyTools())

generator_agent = Agent(
    model=get_base_model(),
    tools=tavily_tools,
    description="You are a knowledge content generation expert. You MUST reply with a valid JSON object only.",
    instructions=[
        "You are a knowledge content generation expert generating high-quality new knowledge base entries.",
        "",
        "## CRITICAL OUTPUT RULE",
        "You MUST output ONLY a valid JSON object. No explanations, no markdown, no text before or after the JSON.",
        "",
        "## Output Schema",
        "{",
        "  \"standardized_problem\": \"<Problem description from user's perspective>\",",
        "  \"accurate_answer\": \"<Complete troubleshooting steps or specification answer>\",",
        "  \"keyword_tags\": [\"<tag1>\", \"<tag2>\", \"<tag3>\"],",
        "  \"applicable_scenario\": \"<Product models, software versions, environments>\",",
        "  \"source\": \"<Official URL or document reference>\",",
        "  \"confidence_score\": <float between 0.0 and 1.0>,",
        "  \"problems\": \"<If confidence < 0.7: explain reliability concerns. Otherwise: None>\"",
        "}",
        "",
        "## Generation Steps",
        "1. Use search tools to find the latest relevant information on the internet.",
        "2. Reference official product manuals, FAQs, and technical bulletins.",
        "3. Fill in all schema fields accurately and completely."
    ],
    output_schema=GenerationOutput
)

# ==================== Workflow Logic ====================

def trigger_preparation_workflow(transcript: str) -> str:
    """
    Executes the first 3 steps of the KB Evolution pipeline and logs everything to SQLite.
    """
    task_id = f"task-{uuid.uuid4().hex[:6]}"
    db: Session = SessionLocal()
    
    try:
        # Step 0: Create Task
        task = KBEvolTask(
            id=task_id,
            title="Imported Log Evolution - Pending",
            desc="Task record waiting for evaluation and generation.",
            status="Step 1: Evaluation Started",
            transcript=transcript,
            progress=0
        )
        db.add(task)
        db.commit()
        
        # Step 1: Evaluator
        logger.info(f"Task {task_id}: Starting Evaluator")
        evaluator_response = evaluator_agent.run(transcript)
        eval_data: EvaluationOutput = evaluator_response.content
        
        # Update Task
        task.gap_cause = eval_data.final_result
        task.title = eval_data.title
        task.desc = eval_data.desc
        task.retrieved_info = eval_data.failure_point
        task.status = "Step 2: Gap Analysis Started"
        task.progress = 10
        
        # Log Agent and route logic
        should_evolve = eval_data.final_result in ["Failed", "Aborted", "Escalated"]
        
        if should_evolve:
            route_status = f"Routed to GapAnalyzer ({eval_data.final_result})"
        else:
            route_status = f"Evaluation Completed. No Evolution Needed ({eval_data.final_result})."

        db.add(AgentLog(
            task_id=task_id,
            agent_name="Evaluator",
            input_data=json.dumps({"transcript": transcript}, ensure_ascii=False),
            output_data=eval_data.model_dump_json(),
            route_status=route_status
        ))
        db.commit()

        if not should_evolve:
            logger.info(f"Task {task_id}: final_result is {eval_data.final_result}. Terminating workflow early.")
            task.status = "终止: 知识未缺失 (Terminated)"
            task.progress = 15
            db.commit()
            return task_id
        
        # Step 2: Gap Analyzer
        logger.info(f"Task {task_id}: Starting Gap Analyzer")
        gap_input = f"Evaluation Report:\n{eval_data.model_dump_json()}\n\nOriginal Transcript:\n{transcript}"
        gap_response = gap_analyzer_agent.run(gap_input)
        gap_data: GapAnalysisOutput = gap_response.content
        
        # Update Task
        task.gap_desc = f"Root Cause: {gap_data.root_cause}\n\nGap Details:\n{gap_data.gap_desc}\n\nOptimized Entries:\n{gap_data.optimized_entries}"
        task.status = "Step 3: Knowledge Generation Started"
        task.progress = 25
        
        # Log Agent
        db.add(AgentLog(
            task_id=task_id,
            agent_name="GapAnalyzer",
            input_data=gap_input,
            output_data=gap_data.model_dump_json(),
            route_status="Routed to KnowledgeGenerator"
        ))
        db.commit()
        
        # Step 3: Knowledge Generator
        logger.info(f"Task {task_id}: Starting Knowledge Generator")
        gen_input = f"Gap Analysis:\n{gap_data.model_dump_json()}\n\nQueries:\n{gap_data.search_queries}\n\nOriginal Transcript:\n{transcript}"
        gen_response = generator_agent.run(gen_input)
        gen_data: GenerationOutput = gen_response.content
        
        # Compile into a beautiful Markdown knowledge entry
        markdown_body = f"""# AI Knowledge Entry: {gen_data.standardized_problem}

## Applicable Scenario
{gen_data.applicable_scenario}

## Resolution Steps / Answer
{gen_data.accurate_answer}

## Technical Details
- **Confidence Score**: {gen_data.confidence_score} (Verified via official sources)
- **Keyword Tags**: {", ".join(gen_data.keyword_tags)}
- **Reference Source**: {gen_data.source}
"""
        if gen_data.confidence_score < 0.7:
            markdown_body += f"\n> [!WARNING]\n> **Identified Issues / Reliability Concerns (Confidence < 0.7)**:\n> {gen_data.problems}\n"

        # Update Task
        task.markdown = markdown_body
        task.source = gen_data.source
        task.status = "步骤4: 人工审批 (Pending HITL)"  
        task.progress = 50
        
        # Log Agent
        db.add(AgentLog(
            task_id=task_id,
            agent_name="KnowledgeGenerator",
            input_data=gen_input,
            output_data=gen_data.model_dump_json(),
            route_status="Preparation Workflow Completed. Pending HITL."
        ))
        db.commit()
        
        return task_id

    except Exception as e:
        logger.error(f"Error in preparation workflow for {task_id}: {e}")
        db.rollback()
        # Attempt to set a failed state
        failed_task = db.query(KBEvolTask).filter(KBEvolTask.id == task_id).first()
        if failed_task:
            failed_task.status = "Failed"
            failed_task.desc = str(e)
            db.commit()
        raise e
    finally:
        db.close()
