import sys
import os
import asyncio

# Adjust python path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from services.agent_service import create_agent_for_request

def main():
    try:
        agent = create_agent_for_request("你好", "test_user")
        print(f"Agent created for model: {agent.model.id}")
        print(f"Base URL: {agent.model.base_url}")
        
        print("\nStarting stream test...")
        stream = agent.run("你好，请做个自我介绍", stream=True)
        
        print("Response stream:")
        full_response = ""
        for idx, chunk in enumerate(stream):
            content = ""
            if isinstance(chunk, str):
                content = chunk
            elif hasattr(chunk, 'content') and chunk.content:
                content = chunk.content
            elif hasattr(chunk, 'delta') and chunk.delta:
                content = chunk.delta
                
            if content:
                full_response += content
                print(content, end="", flush=True)
        
        print(f"\n\nTest completed. Total length: {len(full_response)}")
        
    except Exception as e:
        print(f"\nError during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
