# AgentNex

AI Agent API Server
基于 FastAPI 提供 REST API 接口
使用 agno + dashscope (通义千问)

# AI 对话助手

基于 agno + dashscope (通义千问) 的简单对话 AI Agent。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置 API Key

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 DashScope API Key：

```
DASHSCOPE_API_KEY=your_api_key_here
```

**获取 API Key:**
1. 访问 [阿里云百炼控制台](https://dashscope.console.aliyun.com/)
2. 开通 DashScope 服务
3. 创建 API Key

### 3. 运行 Agent

```bash
python main.py
```

## 使用说明

- 启动后，直接输入问题与 AI 对话
- 输入 `quit`、`exit`、`退出` 或 `q` 退出程序
- 支持 Markdown 格式输出

## 模型说明

默认使用 `qwen-plus` 模型，你也可以修改代码使用其他模型：

- `qwen-turbo`: 速度快，成本低
- `qwen-plus`: 平衡性能和成本
- `qwen-max`: 最强性能
- `qwen-long`: 支持长文本

## 项目结构

```
agent/
├── main.py           # 主程序
├── requirements.txt  # Python 依赖
├── .env.example      # 环境变量示例
└── README.md         # 说明文档
```

## 扩展功能

这个简单的 Agent 可以轻松扩展：

1. **添加工具**: 集成搜索、计算器等工具
2. **添加记忆**: 保存对话历史
3. **添加知识库**: 让 Agent 具备专业知识
4. **多 Agent 协作**: 创建 Agent 团队处理复杂任务

更多功能请参考 [Agno 官方文档](https://docs.agno.com)
