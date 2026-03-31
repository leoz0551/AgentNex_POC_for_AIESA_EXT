import { useState, useCallback, useEffect } from 'react';
import { chatApi } from '../api/chat';
import type { Session, SessionSummary } from '../types';

export function useSessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const data = await chatApi.getSessions();
      setSessions(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, []);

  const createNewSession = useCallback(async (title?: string) => {
    try {
      const session = await chatApi.createSession(title);
      await loadSessions();
      setCurrentSession(session);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  }, [loadSessions]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await chatApi.deleteSession(sessionId);
      await loadSessions();
      if (currentSession?.id === sessionId) {
        setCurrentSession(null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [currentSession, loadSessions]);

  const switchSession = useCallback(async (sessionId: string) => {
    setLoadingSession(true);
    try {
      const session = await chatApi.getSession(sessionId);
      setCurrentSession(session);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    setSessions,
    currentSession,
    setCurrentSession,
    loadingSession,
    loadSessions,
    createNewSession,
    deleteSession,
    switchSession,
  };
}
