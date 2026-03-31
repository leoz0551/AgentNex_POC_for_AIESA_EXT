import { API_BASE, USER_ID } from '../constants';
import type { Memory } from '../types';

export const memoryApi = {
  async getMemories(userId: string = USER_ID): Promise<Memory[]> {
    const res = await fetch(`${API_BASE}/memory/${userId}`);
    const data = await res.json();
    return data.memories || [];
  },

  async deleteMemory(memoryId: string, userId: string = USER_ID): Promise<void> {
    await fetch(`${API_BASE}/memory/${userId}/${memoryId}`, { method: 'DELETE' });
  },

  async clearMemories(userId: string = USER_ID): Promise<void> {
    await fetch(`${API_BASE}/memory/${userId}`, { method: 'DELETE' });
  },
};
