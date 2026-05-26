"""
Test: Verify multi-turn conversation history is correctly loaded by agno Agent.
"""
import asyncio
import json
import httpx

BASE_URL = "http://127.0.0.1:8000"

def call_stream(session_id, message):
    """Calls the streaming chat endpoint and returns full response + session_id."""
    payload = {
        "messages": [{"content": message, "role": "user"}],
        "session_id": session_id,
        "user_id": "test-history-user",
        "web_search_enabled": False
    }
    full_content = ""
    returned_session_id = session_id
    
    with httpx.Client(timeout=120) as client:
        with client.stream("POST", f"{BASE_URL}/chat/stream", json=payload) as response:
            returned_session_id = response.headers.get("X-Session-Id", session_id)
            for line in response.iter_lines():
                if line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        if data.get("done"):
                            full_content = data.get("full_content", full_content)
                        elif data.get("content"):
                            full_content += data["content"]
                    except:
                        pass
    return full_content, returned_session_id


def run_test():
    print("=" * 60)
    print("Multi-Turn History Test")
    print("=" * 60)

    # Round 1: Establish a fact
    print("\n[Round 1] Sending: 'My favorite color is purple. Remember this.'")
    r1, session_id = call_stream(None, "My favorite color is purple. Please remember this.")
    print(f"Session ID: {session_id}")
    print(f"AI Response: {r1[:300]}")

    # Round 2: Reference the fact
    print("\n[Round 2] Sending: 'What is my favorite color?'")
    r2, _ = call_stream(session_id, "What is my favorite color?")
    print(f"AI Response: {r2[:300]}")

    # Round 3: Reference round 1 again after another turn
    print("\n[Round 3] Sending: 'Summarize what I told you in this conversation.'")
    r3, _ = call_stream(session_id, "Summarize what I told you in this conversation.")
    print(f"AI Response: {r3[:300]}")

    print("\n" + "=" * 60)
    if "purple" in r2.lower():
        print("✅ PASS: Agent correctly remembered the favorite color in Round 2!")
    else:
        print("❌ FAIL: Agent did NOT recall the favorite color. History is broken.")

    if "purple" in r3.lower():
        print("✅ PASS: Agent correctly referenced history in Round 3!")
    else:
        print("❌ FAIL: Agent did NOT recall history in Round 3.")
    print("=" * 60)


if __name__ == "__main__":
    run_test()
