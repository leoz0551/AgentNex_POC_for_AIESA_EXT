import { API_BASE, USER_ID } from '../constants';
import type { Session, SessionSummary } from '../types';

export const chatApi = {
  // 获取会话列表
  async getSessions(): Promise<SessionSummary[]> {
    const res = await fetch(`${API_BASE}/sessions`);
    const data = await res.json();
    return data.sessions || [];
  },

  // 获取所有微课程列表
  async getCourses(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/course/list/all`);
    if (!res.ok) throw new Error('Failed to fetch courses');
    return res.json();
  },

  // 获取会话详情
  async getSession(id: string): Promise<Session> {
    const res = await fetch(`${API_BASE}/sessions/${id}`);
    if (!res.ok) throw new Error('Session not found');
    const session = await res.json();
    if (session.messages) {
      session.messages = session.messages.map((m: any) => ({
        ...m,
        courseTaskId: m.courseTaskId || m.course_task_id
      }));
    }
    return session;
  },

  // 创建会话
  async createSession(title = '新对话'): Promise<Session> {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return res.json();
  },

  // 删除会话
  async deleteSession(id: string): Promise<void> {
    await fetch(`${API_BASE}/sessions/${id}`, { method: 'DELETE' });
  },

  // 发送消息（流式）
  async chatStream(
    messages: { content: string; role: string }[],
    sessionId: string | undefined,
    onChunk: (content: string) => void,
    onDone: (data: { session_id: string; full_content: string }) => void,
    onError: (error: string) => void,
    chatBoardMode: boolean = false
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: sessionId, user_id: USER_ID, chat_board_mode: chatBoardMode }),
    });
    if (!res.ok) {
      const error = await res.json();
      onError(error.detail || 'Chat error');
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError('No reader available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                onError(data.error);
              } else if (data.done) {
                onDone({
                  session_id: res.headers.get('X-Session-Id') || '',
                  full_content: data.full_content,
                });
              } else if (data.content) {
                onChunk(data.content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (e) {
      onError(String(e));
    }
  },

  // AI Trainer 专属发送消息（流式）
  async trainerChatStream(
    messages: { content: string; role: string }[],
    sessionId: string | undefined,
    onChunk: (content: string) => void,
    onDone: (data: { session_id: string; full_content: string; course_task_id?: string }) => void,
    onError: (error: string) => void
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/trainer/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, session_id: sessionId, user_id: USER_ID }),
    });
    if (!res.ok) {
      const error = await res.json();
      onError(error.detail || 'Trainer chat error');
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError('No reader available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) {
                onError(data.error);
              } else if (data.done) {
                onDone({
                  session_id: res.headers.get('X-Session-Id') || '',
                  full_content: data.full_content,
                  course_task_id: data.course_task_id,
                });
              } else if (data.content) {
                onChunk(data.content);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (e) {
      onError(String(e));
    }
  },

  // 消息反馈
  async feedback(messageId: string, feedback: 'like' | 'dislike'): Promise<void> {
    await fetch(`${API_BASE}/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    });
  },

  // 重新生成
  async regenerate(sessionId: string): Promise<{
    content: string;
    session_id: string;
    message_id: string;
  }> {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/regenerate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Regenerate error');
    return res.json();
  },

  // 获取微课程任务状态
  async getCourseTask(taskId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/course/${taskId}`);
    if (!res.ok) throw new Error('Task not found');
    return res.json();
  },
};
