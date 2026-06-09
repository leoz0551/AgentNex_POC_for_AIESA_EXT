import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json

from services.agent_service import create_evaluator_agent, create_voice_trainer_stuck_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulation", tags=["simulation"])

class EvaluateRequest(BaseModel):
    transcript: str

class StuckRequest(BaseModel):
    transcript: str

@router.post("/evaluate")
async def evaluate_simulation(request: EvaluateRequest):
    """Evaluate a role-play simulation transcript"""
    try:
        agent = create_evaluator_agent()
        response = agent.run(request.transcript)
        content = response.content
        if isinstance(content, str):
            result = json.loads(content)
        else:
            result = content
        return result
    except Exception as e:
        logger.error(f"Evaluation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stuck")
async def simulation_stuck_tips(request: StuckRequest):
    """Provide coaching tips when trainee is stuck"""
    try:
        agent = create_voice_trainer_stuck_agent()
        response = agent.run(f"Conversation so far:\n{request.transcript}")
        content = response.content
        if isinstance(content, str):
            result = json.loads(content)
        else:
            result = content
        return result
    except Exception as e:
        logger.error(f"Stuck tips error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
