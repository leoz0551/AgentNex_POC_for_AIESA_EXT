import { API_BASE } from '../constants';

export const kbevolApi = {
  async getTasks() {
    const res = await fetch(`${API_BASE}/kbevol/tasks`);
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },
  
  async trigger(transcript: string) {
    const res = await fetch(`${API_BASE}/kbevol/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) throw new Error('Failed to trigger workflow');
    return res.json();
  },

  async uploadTrigger(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/kbevol/upload-trigger`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to upload and trigger workflow');
    }
    return res.json();
  }
};

