import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from services.agent_service import create_agent_for_request
from config import MODEL_ID, OPENROUTER_API_KEY

def test_ppt_generation():
    print(f"Testing PPT Generation for model: {MODEL_ID}")
    
    user_message = "请帮我制作一个关于 AI 智能体 (AI Agent) 的 PPT"
    print(f"User message: {user_message}")
    
    agent = create_agent_for_request(user_message)
    
    # Run the agent
    print("Running agent...")
    response = agent.run(user_message)
    
    print("\n--- Agent Response ---")
    print(response.content if hasattr(response, 'content') else str(response))
    print("----------------------\n")
    
    if "download PPT" in (response.content if hasattr(response, 'content') else str(response)):
        print("SUCCESS: Download link found in response.")
    else:
        print("FAILURE: Download link not found in response.")

if __name__ == "__main__":
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not set")
    else:
        test_ppt_generation()
