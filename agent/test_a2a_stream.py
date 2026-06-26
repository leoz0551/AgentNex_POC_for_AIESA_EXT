import requests
import json
import uuid
import sys
import codecs

# Fix Windows console encoding issues for Chinese characters
sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# configuration
API_URL = "http://localhost:8001/a2a/trainer/v1/message:stream"
API_KEY = "tk-fdaoa8x9m2q5j1s3b7v4c6n8z9m0w2p5l7k4j1h8g6f3d2s"

def test_a2a_stream():
    print(f"Connecting to {API_URL} ...")
    
    # Generate a unique context Id for this session
    context_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    
    # Construct the A2A payload
    payload = {
        "method": "message/send",
        "id": request_id,
        "params": {
            "message": {
                "contextId": context_id,
                "metadata": {
                    "copilotstudio.microsoft.com/a2a/chathistory": [
                        {
                            "From": "user",
                            "Locale": "zh-CN",
                            "Text": "你好，请介绍一下你自己。",
                            "Timestamp": "2023-10-25T12:00:00.000Z"
                        }
                    ]
                }
            }
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    try:
        # Send POST request and stream the response
        with requests.post(API_URL, json=payload, headers=headers, stream=True) as response:
            if response.status_code != 200:
                print(f"Error: HTTP {response.status_code}")
                print(response.text)
                return

            print("Connected. Receiving stream...\n")
            print("-" * 50)
            
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith("data: "):
                        json_str = decoded_line[6:]
                        try:
                            # Parse the JSON-RPC response object
                            data_obj = json.loads(json_str)
                            
                            # Standard checking
                            if data_obj.get("jsonrpc") != "2.0":
                                print(f"[Warning] Not a valid JSON-RPC 2.0 object: {data_obj}")
                                
                            result = data_obj.get("result", {})
                            event_type = result.get("type")
                            
                            if event_type == "MessageChunkEvent":
                                content = result.get("content", "")
                                # Print directly without newline to simulate stream
                                print(content.encode('utf-8', errors='replace').decode('utf-8', errors='replace'), end="", flush=True)
                                
                            elif event_type == "TaskStatusUpdateEvent":
                                status = result.get("status")
                                print(f"\n[System Event: Task {status}]", flush=True)
                                if status == "failed":
                                    print(f"Error detail: {result.get('content')}")
                            else:
                                print(f"\n[Unknown Event]: {data_obj}")
                                
                        except json.JSONDecodeError:
                            print(f"\n[Parse Error] Invalid JSON received: {json_str}")
            print("\n" + "-" * 50)
            print("Stream ended.")
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_a2a_stream()
