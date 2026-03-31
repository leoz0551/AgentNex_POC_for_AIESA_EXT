import { useState, useCallback, useRef } from 'react';
import { knowledgeApi } from '../api/knowledge';
import type { KnowledgeDocument, KnowledgeStats } from '../types';

export function useKnowledge() {
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>([]);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats | null>(null);
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState('');
  const [knowledgeSearchResults, setKnowledgeSearchResults] = useState<any[]>([]);
  const [showAddKnowledge, setShowAddKnowledge] = useState<'none' | 'url' | 'text'>('none');
  const [newUrl, setNewUrl] = useState('');
  const [newTextName, setNewTextName] = useState('');
  const [newTextContent, setNewTextContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  // URL 解析状态
  const [urlParsing, setUrlParsing] = useState(false);
  const [urlParseProgress, setUrlParseProgress] = useState(0);
  const [urlParseError, setUrlParseError] = useState<string | null>(null);
  const [urlParseSuccess, setUrlParseSuccess] = useState(false);

  const loadKnowledgeDocs = useCallback(async () => {
    try {
      const data = await knowledgeApi.getKnowledgeDocuments();
      setKnowledgeDocs(data);
    } catch (error) {
      console.error('Failed to load knowledge docs:', error);
    }
  }, []);

  const loadKnowledgeStats = useCallback(async () => {
    try {
      const data = await knowledgeApi.getKnowledgeStats();
      setKnowledgeStats(data);
    } catch (error) {
      console.error('Failed to load knowledge stats:', error);
    }
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(false);
    
    try {
      const result = await knowledgeApi.uploadKnowledge(file, 'semantic', (percent) => {
        setUploadProgress(percent);
      });
      console.log('Upload result:', result);
      setUploadProgress(100);
      setUploadSuccess(true);
      loadKnowledgeDocs();
      loadKnowledgeStats();
      // 3秒后清除成功状态
      setTimeout(() => {
        setUploadSuccess(false);
        setUploadProgress(0);
      }, 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      // 5秒后清除错误状态
      setTimeout(() => {
        setUploadError(null);
        setUploadProgress(0);
      }, 5000);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
  }, [loadKnowledgeDocs, loadKnowledgeStats]);

  const handleKnowledgeSearch = useCallback(async () => {
    if (!knowledgeSearchQuery.trim()) return;
    try {
      const results = await knowledgeApi.searchKnowledge(knowledgeSearchQuery);
      setKnowledgeSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [knowledgeSearchQuery]);

  const handleAddUrl = useCallback(async () => {
    if (!newUrl.trim()) return;
    
    setUrlParsing(true);
    setUrlParseProgress(0);
    setUrlParseError(null);
    setUrlParseSuccess(false);
    
    // 模拟进度
    const progressInterval = setInterval(() => {
      setUrlParseProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 200);
    
    try {
      await knowledgeApi.addKnowledgeUrl(newUrl);
      clearInterval(progressInterval);
      setUrlParseProgress(100);
      setUrlParseSuccess(true);
      setNewUrl('');
      setShowAddKnowledge('none');
      loadKnowledgeDocs();
      loadKnowledgeStats();
      // 3秒后清除成功状态
      setTimeout(() => {
        setUrlParseSuccess(false);
        setUrlParseProgress(0);
      }, 3000);
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Add URL failed:', error);
      setUrlParseError(error instanceof Error ? error.message : 'Parse failed');
      // 5秒后清除错误状态
      setTimeout(() => {
        setUrlParseError(null);
        setUrlParseProgress(0);
      }, 5000);
    }
    setUrlParsing(false);
  }, [newUrl, loadKnowledgeDocs, loadKnowledgeStats]);

  const handleAddText = useCallback(async () => {
    if (!newTextName.trim() || !newTextContent.trim()) return;
    try {
      await knowledgeApi.addKnowledgeText(newTextName, newTextContent);
      setNewTextName('');
      setNewTextContent('');
      setShowAddKnowledge('none');
      loadKnowledgeDocs();
    } catch (error) {
      console.error('Add text failed:', error);
    }
  }, [newTextName, newTextContent, loadKnowledgeDocs]);

  const handleDeleteDocument = useCallback(async (docId: string) => {
    if (!confirm('确定要删除此文档吗？')) return;
    try {
      await knowledgeApi.deleteKnowledgeDocument(docId);
      setKnowledgeDocs(prev => prev.filter(d => d.id !== docId));
    } catch (error) {
      console.error('Delete document failed:', error);
    }
  }, []);

  const handleClearKnowledge = useCallback(async () => {
    if (!confirm('确定要清空知识库吗？')) return;
    try {
      await knowledgeApi.clearKnowledge();
      setKnowledgeDocs([]);
      setKnowledgeSearchResults([]);
    } catch (error) {
      console.error('Clear knowledge failed:', error);
    }
  }, []);

  return {
    knowledgeDocs,
    knowledgeStats,
    knowledgeSearchQuery,
    setKnowledgeSearchQuery,
    knowledgeSearchResults,
    showAddKnowledge,
    setShowAddKnowledge,
    newUrl,
    setNewUrl,
    newTextName,
    setNewTextName,
    newTextContent,
    setNewTextContent,
    fileInputRef,
    uploading,
    uploadProgress,
    uploadError,
    uploadSuccess,
    // URL 解析状态
    urlParsing,
    urlParseProgress,
    urlParseError,
    urlParseSuccess,
    loadKnowledgeDocs,
    loadKnowledgeStats,
    handleFileUpload,
    handleKnowledgeSearch,
    handleAddUrl,
    handleAddText,
    handleDeleteDocument,
    handleClearKnowledge,
  };
}
