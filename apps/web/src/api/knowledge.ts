import { API_BASE, USER_ID } from '../constants';
import type { KnowledgeDocument, KnowledgeStats } from '../types';

export const knowledgeApi = {
  uploadKnowledge(
    file: File, 
    chunkingStrategy: string = 'semantic',
    onProgress?: (percent: number) => void
  ): Promise<{ doc_id: string; chunk_count: number }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', USER_ID);
      formData.append('chunking_strategy', chunkingStrategy);
      
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            reject(new Error('Invalid response'));
          }
        } else {
          reject(new Error('Upload failed'));
        }
      };
      
      xhr.onerror = () => reject(new Error('Upload failed'));
      
      xhr.open('POST', `${API_BASE}/knowledge/upload`);
      xhr.send(formData);
    });
  },

  async addKnowledgeUrl(url: string): Promise<{ doc_id: string }> {
    const res = await fetch(`${API_BASE}/knowledge/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, user_id: USER_ID }),
    });
    if (!res.ok) {
      // 尝试解析后端返回的错误信息
      try {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Add URL failed');
      } catch {
        throw new Error('Add URL failed');
      }
    }
    return res.json();
  },

  async addKnowledgeText(name: string, text: string): Promise<{ doc_id: string }> {
    const res = await fetch(`${API_BASE}/knowledge/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text, user_id: USER_ID }),
    });
    if (!res.ok) throw new Error('Add text failed');
    return res.json();
  },

  async searchKnowledge(query: string, limit: number = 5): Promise<any[]> {
    const res = await fetch(`${API_BASE}/knowledge/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    const data = await res.json();
    return data.results || [];
  },

  async getKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
    const res = await fetch(`${API_BASE}/knowledge/documents`);
    const data = await res.json();
    return data.documents || [];
  },

  async getKnowledgeDocument(docId: string): Promise<{ document: KnowledgeDocument; preview?: string }> {
    const res = await fetch(`${API_BASE}/knowledge/documents/${docId}`);
    if (!res.ok) throw new Error('Document not found');
    return res.json();
  },

  async deleteKnowledgeDocument(docId: string): Promise<void> {
    await fetch(`${API_BASE}/knowledge/documents/${docId}`, { method: 'DELETE' });
  },

  async getKnowledgeStats(): Promise<KnowledgeStats> {
    const res = await fetch(`${API_BASE}/knowledge/stats`);
    return res.json();
  },

  async clearKnowledge(): Promise<void> {
    await fetch(`${API_BASE}/knowledge`, { method: 'DELETE' });
  },

  // 批量网站抓取 API
  async discoverUrls(url: string, method: 'sitemap' | 'links' | 'both' = 'both', maxLinks: number = 100): Promise<{
    status: string;
    base_url: string;
    total_urls: number;
    urls: string[];
    all_urls_count: number;
  }> {
    const res = await fetch(`${API_BASE}/knowledge/crawl/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, max_links: maxLinks }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Discover URLs failed');
    }
    return res.json();
  },

  async startCrawl(urls: string[], delay: number = 0.5): Promise<{
    status: string;
    task_id: string;
    total_urls: number;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/knowledge/crawl/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, user_id: USER_ID, delay }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Start crawl failed');
    }
    return res.json();
  },

  async getCrawlStatus(taskId: string): Promise<{
    status: string;
    total: number;
    completed: number;
    success: number;
    failed: number;
    results: any[];
  }> {
    const res = await fetch(`${API_BASE}/knowledge/crawl/status/${taskId}`);
    if (!res.ok) throw new Error('Task not found');
    return res.json();
  },

  async quickCrawlWebsite(url: string, maxPages: number = 20, method: 'sitemap' | 'links' = 'sitemap'): Promise<{
    status: string;
    base_url: string;
    total_discovered: number;
    total_crawled: number;
    success_count: number;
    results: any[];
  }> {
    const res = await fetch(`${API_BASE}/knowledge/crawl/quick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, user_id: USER_ID, max_pages: maxPages, method }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Quick crawl failed');
    }
    return res.json();
  },
};
