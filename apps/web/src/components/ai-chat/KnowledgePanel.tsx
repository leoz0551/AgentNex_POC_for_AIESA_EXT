import { Upload, Link, FileText, Search, Trash2, BookOpen, Loader2, CheckCircle, AlertCircle, Globe, ExternalLink, ChevronDown, ChevronUp, FileSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@workspace/ui/components/button';
import type { KnowledgeDocument, KnowledgeStats } from '../../types';
import { FILE_TYPE_ICONS, SUPPORTED_FILE_TYPES } from '../../constants';
import { useState } from 'react';

interface KnowledgePanelProps {
  knowledgeDocs: KnowledgeDocument[];
  knowledgeStats: KnowledgeStats | null;
  knowledgeSearchQuery: string;
  setKnowledgeSearchQuery: (query: string) => void;
  knowledgeSearchResults: any[];
  showAddKnowledge: 'none' | 'url' | 'text';
  setShowAddKnowledge: (show: 'none' | 'url' | 'text') => void;
  newUrl: string;
  setNewUrl: (url: string) => void;
  newTextName: string;
  setNewTextName: (name: string) => void;
  newTextContent: string;
  setNewTextContent: (content: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearch: () => void;
  onAddUrl: () => void;
  onAddText: () => void;
  onDeleteDocument: (docId: string) => void;
  onClearKnowledge: () => void;
  uploading?: boolean;
  uploadProgress?: number;
  uploadError?: string | null;
  uploadSuccess?: boolean;
  // URL 解析状态
  urlParsing?: boolean;
  urlParseProgress?: number;
  urlParseError?: string | null;
  urlParseSuccess?: boolean;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export function KnowledgePanel({
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
  onFileUpload,
  onSearch,
  onAddUrl,
  onAddText,
  onDeleteDocument,
  onClearKnowledge,
  uploading = false,
  uploadProgress = 0,
  uploadError = null,
  uploadSuccess = false,
  urlParsing = false,
  urlParseProgress = 0,
  urlParseError = null,
  urlParseSuccess = false,
}: KnowledgePanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      {/* 上传状态提示 */}
      {(uploading || uploadSuccess || uploadError) && (
        <div className={`p-3 rounded-lg text-sm animate-fade-in ${
          uploading 
            ? 'bg-violet-500/10 border border-violet-500/20' 
            : uploadSuccess 
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-red-500/10 border border-red-500/20'
        }`} style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {uploading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-violet-600 dark:text-violet-400 font-medium">{t('upload.uploading')}</span>
                <span className="text-violet-600 dark:text-violet-400 font-bold">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-violet-500/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : uploadSuccess ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">{t('upload.success')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600 dark:text-red-400">{t('upload.failed')}{uploadError ? `: ${uploadError}` : ''}</span>
            </div>
          )}
        </div>
      )}
      
      {/* URL 解析状态提示 */}
      {(urlParsing || urlParseSuccess || urlParseError) && (
        <div className={`p-3 rounded-lg text-sm animate-fade-in ${
          urlParsing 
            ? 'bg-blue-500/10 border border-blue-500/20' 
            : urlParseSuccess 
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-red-500/10 border border-red-500/20'
        }`} style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {urlParsing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4 animate-pulse" />
                  {t('knowledge.parsing')}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{Math.round(urlParseProgress)}%</span>
              </div>
              <div className="h-2 bg-blue-500/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-300"
                  style={{ width: `${urlParseProgress}%` }}
                />
              </div>
            </div>
          ) : urlParseSuccess ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">{t('knowledge.parseSuccess')}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400">{t('knowledge.parseFailed')}</span>
              </div>
              {urlParseError && (
                <p className="text-xs text-red-500/80 ml-6">{urlParseError}</p>
              )}
              <p className="text-xs text-muted-foreground ml-6">{t('knowledge.parseFailedHint')}</p>
            </div>
          )}
        </div>
      )}

      {/* 上传和添加 */}
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onFileUpload}
          accept={SUPPORTED_FILE_TYPES}
        />
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`h-9 ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            {t('knowledge.uploadFile')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddKnowledge(showAddKnowledge === 'url' ? 'none' : 'url')} className="h-9">
            <Link className="h-4 w-4 mr-1.5" />
            {t('knowledge.addUrl')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddKnowledge(showAddKnowledge === 'text' ? 'none' : 'text')} className="h-9">
            <FileText className="h-4 w-4 mr-1.5" />
            {t('knowledge.addText')}
          </Button>
        </div>

        {/* 添加URL表单 */}
        {showAddKnowledge === 'url' && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-3 animate-fade-in" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <input
              type="url"
              placeholder={t('knowledge.urlPlaceholder')}
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/30 transition-all"
            />
            <p className="text-[11px] text-muted-foreground">
              💡 {t('knowledge.urlHint')}
            </p>
            <Button size="sm" onClick={onAddUrl} className="w-full h-9">{t('common.add')}</Button>
          </div>
        )}

        {/* 添加文本表单 */}
        {showAddKnowledge === 'text' && (
          <div className="p-4 rounded-lg bg-muted/50 space-y-3 animate-fade-in" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <input
              type="text"
              placeholder={t('knowledge.textNamePlaceholder')}
              value={newTextName}
              onChange={(e) => setNewTextName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/30 transition-all"
            />
            <textarea
              placeholder={t('knowledge.textContentPlaceholder')}
              value={newTextContent}
              onChange={(e) => setNewTextContent(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground min-h-[120px] focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/30 transition-all"
            />
            <Button size="sm" onClick={onAddText} className="w-full h-9">{t('common.add')}</Button>
          </div>
        )}
      </div>

      {/* 搜索 */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={t('knowledge.searchPlaceholder')}
          value={knowledgeSearchQuery}
          onChange={(e) => setKnowledgeSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          className="flex-1 px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/30 transition-all"
        />
        <Button variant="outline" size="sm" onClick={onSearch} className="h-10 w-10 rounded-lg">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* 搜索结果 */}
      {knowledgeSearchResults.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-medium">{t('knowledge.searchResults', { count: knowledgeSearchResults.length })}</p>
          <SearchResults results={knowledgeSearchResults} t={t} />
        </div>
      )}

      {/* 统计信息 */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('knowledge.stats.documents')}</p>
            <p className="text-lg font-semibold text-violet-600 dark:text-violet-400">
              {knowledgeStats?.total_documents ?? knowledgeDocs.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('knowledge.stats.vectors')}</p>
            <p className={`text-lg font-semibold ${knowledgeStats?.total_vectors ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {knowledgeStats?.total_vectors ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t('knowledge.stats.size')}</p>
            <p className="text-lg font-semibold text-violet-600 dark:text-violet-400">
              {(knowledgeStats?.total_size_mb ?? 0).toFixed(1)} MB
            </p>
          </div>
        </div>
        {knowledgeStats && knowledgeStats.total_vectors === 0 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-3 text-center">
            ⚠️ {t('knowledge.vectorWarning')}
          </p>
        )}
        {knowledgeStats?.test_search_count !== undefined && knowledgeStats.test_search_count > 0 && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-3 text-center">
            ✓ {t('knowledge.testSearchSuccess', { count: knowledgeStats.test_search_count })}
          </p>
        )}
      </div>

      {/* 文档列表 */}
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium">{t('knowledge.uploadedDocs')}</p>
        {knowledgeDocs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onClearKnowledge} className="text-red-500 text-xs h-7 px-3 hover:bg-red-500/10">
            {t('knowledge.clearAll')}
          </Button>
        )}
      </div>

      {knowledgeDocs.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium text-foreground">{t('knowledge.empty')}</p>
          <p className="text-xs mt-1">{t('knowledge.emptyDesc')}</p>
          <p className="text-[11px] mt-2">
            {t('knowledge.supportedFormats')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {knowledgeDocs.map((doc, i) => (
            <DocumentCard 
              key={doc.id || i} 
              doc={doc} 
              onDeleteDocument={onDeleteDocument}
              t={t}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// 搜索结果组件 - 支持展开/收起
function SearchResults({ results, t }: { results: any[]; t: (key: string, options?: any) => string }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  
  const toggleExpand = (index: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };
  
  // 提取内容
  const getContent = (result: any) => {
    if (result.content) return result.content;
    if (result.chunk) return result.chunk;
    if (result.text) return result.text;
    return '';
  };
  
  // 提取来源
  const getSource = (result: any) => {
    const meta = result.metadata || result.meta_data || {};
    return meta.filename || meta.source || meta.name || t('knowledge.unknownSource');
  };
  
  // 提取相关度分数
  const getScore = (result: any) => {
    return result.score || result.distance || result.relevance;
  };
  
  // 截断内容
  const truncateContent = (content: string, maxLength: number = 300) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <>
      {results.map((result, i) => {
        const content = getContent(result);
        const source = getSource(result);
        const score = getScore(result);
        const isExpanded = expanded.has(i);
        const isUrl = source.startsWith('http');
        
        return (
          <div 
            key={i} 
            className="p-4 rounded-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 text-sm animate-fade-in"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            {/* 来源和分数 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isUrl ? (
                  <>
                    <Globe className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[180px]" title={source}>
                      {source.replace(/^https?:\/\//, '').split('/')[0]}
                    </span>
                  </>
                ) : (
                  <span className="truncate max-w-[200px]">{source}</span>
                )}
              </div>
              {score !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400">
                  {t('knowledge.relevance', { percent: (score * 100).toFixed(0) })}
                </span>
              )}
            </div>
            
            {/* 内容 */}
            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {isExpanded || content.length <= 300 ? content : truncateContent(content)}
            </div>
            
            {/* 展开/收起按钮 */}
            {content.length > 300 && (
              <button
                onClick={() => toggleExpand(i)}
                className="flex items-center gap-1 mt-2 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    {t('knowledge.collapse')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    {t('knowledge.expandAll', { count: content.length })}
                  </>
                )}
              </button>
            )}
            
            {/* 原文链接 */}
            {isUrl && (
              <a
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t('knowledge.viewOriginal')}
              </a>
            )}
          </div>
        );
      })}
    </>
  );
}

// 文档卡片组件
function DocumentCard({ 
  doc, 
  onDeleteDocument,
  t 
}: { 
  doc: KnowledgeDocument; 
  onDeleteDocument: (docId: string) => void;
  t: (key: string, options?: any) => string;
}) {
  const [showSummary, setShowSummary] = useState(false);
  
  const isUrl = doc.type === 'url' || (doc.filename && doc.filename.startsWith('http'));
  const icon = isUrl ? null : (FILE_TYPE_ICONS[doc.type || ''] || '📄');
  
  // 从 URL 提取域名
  const extractDomain = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };
  
  const domain = isUrl && doc.filename ? extractDomain(doc.filename) : null;
  
  // 截断显示 URL
  const truncateUrl = (url: string, maxLength: number = 40) => {
    if (url.length <= maxLength) return url;
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.search;
      if (path.length > 10) {
        return `${urlObj.hostname}${path.slice(0, 15)}...`;
      }
      return url.slice(0, maxLength) + '...';
    } catch {
      return url.slice(0, maxLength) + '...';
    }
  };

  return (
    <div 
      className={`group rounded-lg transition-all duration-200 ${
        isUrl 
          ? 'bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40' 
          : 'bg-muted/50 hover:bg-muted/80'
      }`}
    >
      {/* 主要内容行 */}
      <div className="p-3 flex items-start gap-3">
        {isUrl ? (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
            <Globe className="h-5 w-5 text-white" />
          </div>
        ) : (
          <span className="text-lg w-10 h-10 flex items-center justify-center bg-muted rounded-lg">{icon}</span>
        )}
        <div className="flex-1 min-w-0">
          {isUrl ? (
            <>
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-foreground">
                  {doc.title || domain || t('knowledge.website')}
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
                  URL
                </span>
              </div>
              {/* 摘要信息 */}
              {doc.summary && (
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {doc.summary}
                </p>
              )}
              <p className="truncate text-[10px] text-muted-foreground/70 mt-1" title={doc.filename}>
                {truncateUrl(doc.filename || '', 60)}
              </p>
              {/* 向量数量 */}
              {doc.chunk_count && doc.chunk_count > 0 && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  ✓ {t('knowledge.vectorsIndexed', { count: doc.chunk_count })}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="truncate font-medium text-foreground">{doc.filename || doc.name}</p>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                {doc.chunk_count != null && doc.chunk_count > 0 && <span>{doc.chunk_count} {t('knowledge.chunks')}</span>}
                {doc.size && <span>{formatFileSize(doc.size)}</span>}
                {doc.created_at && <span>{new Date(doc.created_at).toLocaleDateString()}</span>}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isUrl && doc.summary && (
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-500/20 text-blue-500 transition-all"
              title={showSummary ? t('knowledge.collapseSummary') : t('knowledge.viewSummary')}
            >
              <FileSearch className="h-4 w-4" />
            </button>
          )}
          {isUrl && (
            <button
              onClick={() => window.open(doc.filename, '_blank')}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-blue-500/20 text-blue-500 transition-all"
              title={t('common.open')}
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onDeleteDocument(doc.id)}
            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-red-500 transition-all"
            title={t('common.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* 展开的详细摘要 */}
      {isUrl && showSummary && doc.summary && (
        <div className="px-3 pb-3 pt-0">
          <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <p className="text-xs text-muted-foreground font-medium mb-1.5">{t('knowledge.webSummary')}</p>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {doc.summary}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
