import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from services.agent_service import create_agent_for_request
from config import MODEL_ID, OPENROUTER_API_KEY

def test_language_consistency():
    """
    Test that an English request for PPT generation stays in English.
    """
    print(f"Testing Language Consistency for model: {MODEL_ID}")
    
    # Simulate a message that might have a Chinese prefix from the UI but English core content
    user_message = "请根据以下内容生成一份 PPT 大纲：\nGenerate a 7-page PPT about chatbots."
    print(f"User message (simulated with prefix): {user_message}")
    
    agent = create_agent_for_request(user_message)
    
    # Run the agent
    print("Running agent...")
    response = agent.run(user_message)
    
    content = response.content if hasattr(response, 'content') else str(response)
    print("\n--- Agent Response ---")
    print(content)
    print("----------------------\n")
    
    # Check for Chinese characters in the response (simple heuristic)
    has_chinese = any('\u4e00' <= char <= '\u9fff' for char in content)
    
    if not has_chinese and "Download the PPT" in content:
        print("SUCCESS: Response is in English and contains the download link.")
    elif has_chinese:
        print("FAILURE: Response contains Chinese characters.")
    else:
        print("FAILURE: Unexpected response format.")

if __name__ == "__main__":
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not set")
    else:
        test_language_consistency()
