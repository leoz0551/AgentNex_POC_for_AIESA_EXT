// 根据环境变量确定API基础URL
const isProduction = import.meta.env.MODE === 'production';
export const API_BASE = isProduction 
  ? 'http://10.62.79.180:8000' 
  : 'http://localhost:8000';

export const USER_ID = 'default';

// 文件类型图标映射
export const FILE_TYPE_ICONS: Record<string, string> = {
  '.pdf': '📕',
  '.txt': '📄',
  '.md': '📝',
  '.markdown': '📝',
  '.html': '🌐',
  '.htm': '🌐',
  '.url': '🔗',
  'url': '🔗',
  'text': '📝',
};

// 支持的文件格式
export const SUPPORTED_FILE_TYPES = '.pdf,.txt,.md,.markdown,.html,.htm,.doc,.docx';