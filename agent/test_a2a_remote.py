import requests
import json
import uuid
import sys
import codecs

# 修复 Windows 控制台中文字符打印的编码问题
sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# --- 配置区 ---
# 远程服务器地址
API_URL = "https://agentnex.cc/a2a/trainer/v1/message:stream"
# 测试环境中约定好的 50 位长度的鉴权 Key
API_KEY = "tk-fdaoa8x9m2q5j1s3b7v4c6n8z9m0w2p5l7k4j1h8g6f3d2s"

def test_remote_a2a_stream():
    print(f"Connecting to remote server: {API_URL} ...")
    
    # 模拟每次聊天产生一个全新的会话上下文ID
    context_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    
    # 按照 Copilot Studio A2A 标准规范构造 JSON-RPC 载荷
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
                            "Text": "你好，请详细介绍一下你们产品的核心功能。",
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
        # 发送带鉴权头的 POST 请求，并保持连接流持续接收 (stream=True)
        with requests.post(API_URL, json=payload, headers=headers, stream=True) as response:
            # 校验 HTTP 状态码
            if response.status_code != 200:
                print(f"Error: HTTP {response.status_code}")
                print(response.text)
                return

            print("Connected. Receiving stream from remote...\n")
            print("-" * 50)
            
            # 逐行读取大模型推流回来的数据块
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    # 识别 Server-Sent Events 的标准前缀
                    if decoded_line.startswith("data: "):
                        json_str = decoded_line[6:]
                        try:
                            # 还原被包装在里面的 JSON-RPC 协议内容
                            data_obj = json.loads(json_str)
                            
                            result = data_obj.get("result", {})
                            event_type = result.get("type")
                            
                            if event_type == "MessageChunkEvent":
                                content = result.get("content", "")
                                # 去掉换行符，模拟打字机平滑输出的效果
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
        print(f"Network request failed: {e}")

if __name__ == "__main__":
    test_remote_a2a_stream()
