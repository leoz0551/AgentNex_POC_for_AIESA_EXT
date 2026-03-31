// 消息类型
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  feedback?: 'like' | 'dislike' | null;
}

// 会话类型
export interface Session {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

// 会话摘要
export interface SessionSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

// 记忆类型 - 匹配 agno UserMemory schema
export interface Memory {
  memory_id: string;
  memory: string;
  topics?: string[];
  user_id?: string;
  input?: string;
  created_at?: string | number;  // 可能是 ISO 字符串或秒级时间戳
  updated_at?: string | number;
  feedback?: string;
  agent_id?: string;
  team_id?: string;
}

// 知识库文档
export interface KnowledgeDocument {
  id: string;
  filename: string;
  name: string;
  path: string;
  file_path: string;
  type: string;
  doc_type?: string;
  size?: number;
  modified?: string;
  chunk_count?: number;
  created_at?: string;
  user_id?: string;
  // 网页元信息
  title?: string;
  summary?: string;
}

// 右侧面板视图类型
export type PanelView = 'none' | 'memory' | 'knowledge' | 'tools' | 'skills' | 'prompts';

// 知识库统计
export interface KnowledgeStats {
  total_documents: number;
  total_vectors: number;
  total_size_mb: number;
  test_search_count?: number;
}

// 建议提示词
export interface SuggestedPrompt {
  icon: React.ComponentType<{ className?: string; color?: string }>;
  text: string;
  desc: string;
  iconBg: string;
}
