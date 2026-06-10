// 根据环境变量确定API基础URL
const isProduction = import.meta.env.MODE === 'production';

// 1. 后端常规 API
export const API_BASE = isProduction 
  ? '/api' 
  : 'http://localhost:8001';

// 2. 课程详情文字转语音 (TTS WS)
export const TTS_WS_URL = isProduction 
  ? `wss://${window.location.host}/voice-ws/ws/v1/tts`
  : 'ws://127.0.0.1:8005/ws/v1/tts';

// 3. 角色扮演双工语音 (Voice WS)
export const LOCAL_VOICE_WS_URL = isProduction 
  ? `wss://${window.location.host}/voice-ws/ws/v2/voice`
  : 'ws://127.0.0.1:8005/ws/v2/voice';

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