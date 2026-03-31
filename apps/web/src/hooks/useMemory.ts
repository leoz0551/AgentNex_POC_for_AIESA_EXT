import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { memoryApi } from '../api/memory';
import type { Memory } from '../types';

export function useMemory() {
  const { t } = useTranslation();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await memoryApi.getMemories();
      setMemories(data);
    } catch (error) {
      console.error('Failed to load memories:', error);
      setError('Failed to load memories. Please check if the backend server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMemory = useCallback(async (memoryId: string) => {
    setError(null);
    try {
      await memoryApi.deleteMemory(memoryId);
      loadMemories();
    } catch (error) {
      console.error('Delete memory failed:', error);
      setError('Failed to delete memory');
    }
  }, [loadMemories]);

  const clearMemories = useCallback(async () => {
    if (!confirm(t('memory.clearAllConfirm'))) return;
    setError(null);
    try {
      await memoryApi.clearMemories();
      setMemories([]);
    } catch (error) {
      console.error('Clear memories failed:', error);
      setError('Failed to clear memories');
    }
  }, [t]);

  return {
    memories,
    setMemories,
    loadMemories,
    deleteMemory,
    clearMemories,
    error,
    loading,
  };
}
