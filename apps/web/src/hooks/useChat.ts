import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { chatApi } from '../api/chat';
import type { Session, Message } from '../types';

interface UseChatOptions {
  currentSession: Session | null;
  setCurrentSession: React.Dispatch<React.SetStateAction<Session | null>>;
  loadSessions: () => Promise<void>;
}

export function useChat({ currentSession, setCurrentSession, loadSessions }: UseChatOptions) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const originalMessageCountRef = useRef(0);

  const messages = currentSession?.messages || [];

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [inputValue]);

  // 发送消息（流式）
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // 记录原始消息数量，用于判断是否需要更新标题
    originalMessageCountRef.current = currentSession?.messages?.length || 0;

    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      content: userMessage,
      role: 'user',
      timestamp: new Date().toISOString(),
    };

    const tempAiMsgId = `temp-ai-${Date.now()}`;
    let accumulatedContent = '';

    setCurrentSession(prev => {
      if (!prev) {
        return {
          id: '',
          title: userMessage.slice(0, 20),
          messages: [tempUserMsg],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return {
        ...prev,
        messages: [...prev.messages, tempUserMsg],
      };
    });

    try {
      const messageHistory = currentSession?.messages?.map(m => ({
        content: m.content,
        role: m.role,
      })) || [];

      await chatApi.chatStream(
        [...messageHistory, { content: userMessage, role: 'user' }],
        currentSession?.id,
        (chunk) => {
          accumulatedContent += chunk;
          setCurrentSession(prev => {
            if (!prev) return prev;
            const messages = [...prev.messages];
            const existingAiMsg = messages.find(m => m.id === tempAiMsgId);
            if (existingAiMsg) {
              existingAiMsg.content = accumulatedContent;
            } else {
              messages.push({
                id: tempAiMsgId,
                content: accumulatedContent,
                role: 'assistant',
                timestamp: new Date().toISOString(),
              });
            }
            return { ...prev, messages };
          });
        },
        (data) => {
          setCurrentSession(prev => {
            if (!prev) return prev;
            // 如果是第一次对话（原始消息数为0），用用户消息前20字符作为标题
            const shouldUpdateTitle = originalMessageCountRef.current === 0;
            return {
              ...prev,
              id: data.session_id,
              title: shouldUpdateTitle ? userMessage.slice(0, 20) + (userMessage.length > 20 ? '...' : '') : prev.title,
              messages: prev.messages.map(m =>
                m.id === tempAiMsgId ? { ...m, content: data.full_content, id: `ai-${Date.now()}` } : m
              ),
            };
          });
          loadSessions();
        },
        (error) => {
          console.error('Chat error:', error);
          setCurrentSession(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map(m =>
                m.id === tempAiMsgId
                  ? { ...m, content: t('chat.errorMessage'), id: `error-${Date.now()}` }
                  : m
              ),
            };
          });
        }
      );
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentSession, setCurrentSession, loadSessions, t]);

  // 复制消息
  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // 消息反馈
  const handleFeedback = useCallback(async (messageId: string, feedback: 'like' | 'dislike') => {
    try {
      await chatApi.feedback(messageId, feedback);
      setCurrentSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map(m =>
            m.id === messageId ? { ...m, feedback } : m
          ),
        };
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  }, [setCurrentSession]);

  // 重新生成
  const handleRegenerate = useCallback(async () => {
    if (!currentSession) return;
    setIsLoading(true);
    try {
      const response = await chatApi.regenerate(currentSession.id);
      setCurrentSession(prev => {
        if (!prev) return prev;
        const newMessages = [...prev.messages];
        const lastAiIndex = newMessages.length - 1;
        if (lastAiIndex >= 0 && newMessages[lastAiIndex].role === 'assistant') {
          newMessages[lastAiIndex] = {
            ...newMessages[lastAiIndex],
            id: response.message_id,
            content: response.content,
          };
        }
        return { ...prev, messages: newMessages };
      });
    } catch (error) {
      console.error('Regenerate error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession, setCurrentSession]);

  return {
    inputValue,
    setInputValue,
    isLoading,
    copiedId,
    inputFocused,
    setInputFocused,
    textareaRef,
    messagesEndRef,
    messages,
    handleSubmit,
    copyToClipboard,
    handleFeedback,
    handleRegenerate,
  };
}
