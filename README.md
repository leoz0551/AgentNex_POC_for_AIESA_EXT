# AgentNex

智能代理系统 - 具备工具调用、记忆管理和知识库检索能力

# LegendAgent

一个基于 Vite 和 shadcn/ui 构建的 Monorepo 前端模板项目。

## 功能特性

- **Monorepo 架构**: 使用 pnpm workspace 管理多个应用和共享包
- **AI 对话 Agent**: 集成 agno 和 DashScope (通义千问) 的智能对话功能
- **现代化前端栈**: React 19 + TypeScript + Vite + Tailwind CSS
- **UI 组件库**: 基于 shadcn/ui 的可复用组件库
- **高效构建**: 使用 Turbo 进行任务编排和缓存

## 快速开始

### 1. 环境准备

确保已安装：
- Node.js >= 20
- pnpm >= 9.15.9

```bash
# 启用 corepack (如果尚未启用)
corepack enable

# 或者手动安装 pnpm
npm install -g pnpm@9.15.9
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置 AI Agent

1. 访问 [DashScope 控制台](https://dashscope.console.aliyun.com/) 获取 API Key
2. 复制 `agent/.env.example` 为 `agent/.env`
3. 在 `.env` 文件中填入您的 API Key:

```env
DASHSCOPE_API_KEY=your_actual_api_key_here
```

### 4. 启动项目

**启动后端 API 服务:**
```bash
cd agent
python agent_api.py
# 或者
python -m uvicorn agent_api:app --host 0.0.0.0 --port 8000
```

**启动前端开发服务器:**
```bash
# 在另一个终端窗口
pnpm dev
```

### 5. 访问应用

打开浏览器访问 `http://localhost:5173` (或其他 Vite 指定的端口)

## 项目结构

```
.
├── agent/                 # AI Agent 后端服务
│   ├── agent_api.py      # FastAPI 后端接口
│   ├── main.py          # 命令行版本
│   ├── simple.py        # 简单示例
│   └── .env             # 环境变量配置
├── apps/
│   └── web/             # Web 应用
│       └── src/
│           ├── components/ai-chat.tsx  # AI 聊天组件
│           └── App.tsx  # 主应用组件
└── packages/
    └── ui/              # 共享 UI 组件库
```

## 开发命令

- `pnpm dev`: 启动所有应用的开发服务器
- `pnpm build`: 构建生产版本
- `pnpm lint`: 代码检查
- `pnpm format`: 代码格式化
- `pnpm typecheck`: TypeScript 类型检查

## 添加新组件

```bash
pnpm dlx shadcn@latest add <component-name> -c apps/web
```

## 技术栈

- **前端**: React 19, TypeScript, Vite, Tailwind CSS
- **UI 库**: shadcn/ui (基于 Radix UI)
- **后端**: Python, FastAPI, agno, DashScope
- **构建工具**: Turbo, pnpm
- **代码规范**: Prettier, ESLint

## 注意事项

- 确保 DashScope API Key 正确配置
- 后端 API 默认运行在 `http://localhost:8000`
- 前端开发服务器默认运行在 `http://localhost:5173`
- 在生产环境中，请配置正确的 CORS 策略和 API 地址