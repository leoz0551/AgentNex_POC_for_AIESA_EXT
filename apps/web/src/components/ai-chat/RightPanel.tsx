import { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, BookOpen, X, Wand2, Trash2, Sparkles, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PanelView, KnowledgeDocument, KnowledgeStats, Memory } from '../../types';
import { MemoryPanel } from './MemoryPanel';
import { KnowledgePanel } from './KnowledgePanel';
import { ToolsPanel } from './ToolsPanel';
import { PromptsPanel } from './PromptsPanel';
import { Button } from '@workspace/ui/components/button';

interface RightPanelProps {
  panelView: PanelView;
  onClose: () => void;
  // Memory
  memories: Memory[];
  onDeleteMemory: (memoryId: string) => void;
  onClearMemories: () => void;
  memoryError?: string | null;
  memoryLoading?: boolean;
  // Knowledge
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
  onKnowledgeSearch: () => void;
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
  // Tools
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  // Prompts
  onPromptSelect: (prompt: string) => void;
  onOpenSettings?: () => void;
}

const PANEL_WIDTH_KEY = 'legendagent_panel_width';
const DEFAULT_PROMPTS_WIDTH = 480;
const DEFAULT_WIDTH = 384;
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;

export function RightPanel({
  panelView,
  onClose,
  memories,
  onDeleteMemory,
  onClearMemories,
  memoryError,
  memoryLoading,
  onPromptSelect,
  ...knowledgeProps
}: RightPanelProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState<{ prompts: number; other: number }>(() => {
    // 从 localStorage 恢复宽度
    try {
      const saved = localStorage.getItem(PANEL_WIDTH_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          prompts: parsed.prompts || DEFAULT_PROMPTS_WIDTH,
          other: parsed.other || DEFAULT_WIDTH,
        };
      }
    } catch {
      // ignore
    }
    return {
      prompts: DEFAULT_PROMPTS_WIDTH,
      other: DEFAULT_WIDTH,
    };
  });

  // 获取当前宽度
  const currentWidth = panelView === 'prompts' ? panelWidth.prompts : panelWidth.other;

  // 保存宽度到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, JSON.stringify(panelWidth));
    } catch {
      // ignore
    }
  }, [panelWidth]);

  // 拖拽处理
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    setIsResizing(true);
  }, [currentWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    // 计算增量：向右拖拽 = 面板变宽
    const delta = e.clientX - startXRef.current;
    const newWidth = startWidthRef.current + delta;
    const clampedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
    
    setPanelWidth(prev => ({
      ...prev,
      [panelView === 'prompts' ? 'prompts' : 'other']: clampedWidth,
    }));
  }, [isResizing, panelView]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (panelView === 'none') return null;

  const getTitle = () => {
    switch (panelView) {
      case 'memory': return t('memory.title');
      case 'knowledge': return t('knowledge.title');
      case 'tools': return t('tools.title');
      case 'prompts': return t('prompts.title');
      default: return '';
    }
  };
  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
      />
      
      <div 
        ref={panelRef}
        className="fixed md:relative inset-y-0 right-0 z-50 md:z-auto border-border/60 bg-background/80 backdrop-blur-xl flex flex-col shadow-[inset_-1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_-1px_0_0_0_rgba(255,255,255,0.05)] md:shadow-none"
        style={{
          width: `min(100vw, ${currentWidth}px)`,
          animation: isResizing ? 'none' : 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* 拖拽手柄 - 只在 md 以上显示，位于面板右侧 */}
        <div
          className="hidden md:block absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group z-20"
          onMouseDown={handleMouseDown}
        >
          {/* 悬停时的背景高亮 */}
          <div className="absolute inset-0 bg-transparent group-hover:bg-violet-500/20 transition-colors" />
          {/* 始终显示的指示线 */}
          <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-border group-hover:bg-violet-500 transition-colors" />
          {/* 悬停时显示的拖拽图标 */}
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border rounded px-0.5 py-1 shadow-md">
            <GripVertical className="h-4 w-2.5 text-violet-500" />
          </div>
        </div>

        {/* Hero Section Title */}
        <div className="relative overflow-hidden px-4 md:px-5 py-4 md:py-5 border-b border-border/40">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-pink-500/5" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              {/* Icon with glow effect */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg blur-lg opacity-40 animate-pulse" />
                <div className="relative flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 shadow-lg shadow-violet-500/30">
                  {panelView === 'memory' && <Brain className="h-4 w-4 md:h-5 md:w-5 text-white animate-shimmer" />}
                  {panelView === 'knowledge' && <BookOpen className="h-4 w-4 md:h-5 md:w-5 text-white animate-shimmer" />}
                  {panelView === 'tools' && <Wand2 className="h-4 w-4 md:h-5 md:w-5 text-white animate-shimmer" />}
                  {panelView === 'prompts' && <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-white animate-shimmer" />}
                </div>
              </div>
              {/* Title with gradient text */}
              <div>
                <h2 className="text-base md:text-lg font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient-x">
                  {getTitle()}
                </h2>
              </div>
            </div>
            
            <button 
              onClick={onClose} 
              className="relative p-2 md:p-2.5 rounded-full bg-gradient-to-r from-background/80 to-background/60 border border-border/50 hover:border-violet-500/30 transition-all duration-300 hover:scale-110 active:scale-95 hover:shadow-lg hover:shadow-violet-500/10 dark:hover:border-violet-400/40"
            >
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 md:py-5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {panelView === 'memory' && (
            <MemoryPanel
              memories={memories}
              onDeleteMemory={onDeleteMemory}
              error={memoryError}
              loading={memoryLoading}
            />
          )}

          {panelView === 'knowledge' && (
            <KnowledgePanel
              knowledgeDocs={knowledgeProps.knowledgeDocs}
              knowledgeStats={knowledgeProps.knowledgeStats}
              knowledgeSearchQuery={knowledgeProps.knowledgeSearchQuery}
              setKnowledgeSearchQuery={knowledgeProps.setKnowledgeSearchQuery}
              knowledgeSearchResults={knowledgeProps.knowledgeSearchResults}
              showAddKnowledge={knowledgeProps.showAddKnowledge}
              setShowAddKnowledge={knowledgeProps.setShowAddKnowledge}
              newUrl={knowledgeProps.newUrl}
              setNewUrl={knowledgeProps.setNewUrl}
              newTextName={knowledgeProps.newTextName}
              setNewTextName={knowledgeProps.setNewTextName}
              newTextContent={knowledgeProps.newTextContent}
              setNewTextContent={knowledgeProps.setNewTextContent}
              fileInputRef={knowledgeProps.fileInputRef}
              onFileUpload={knowledgeProps.onFileUpload}
              onSearch={knowledgeProps.onKnowledgeSearch}
              onAddUrl={knowledgeProps.onAddUrl}
              onAddText={knowledgeProps.onAddText}
              onDeleteDocument={knowledgeProps.onDeleteDocument}
              onClearKnowledge={knowledgeProps.onClearKnowledge}
              uploading={knowledgeProps.uploading}
              uploadProgress={knowledgeProps.uploadProgress}
              uploadError={knowledgeProps.uploadError}
              uploadSuccess={knowledgeProps.uploadSuccess}
              urlParsing={knowledgeProps.urlParsing}
              urlParseProgress={knowledgeProps.urlParseProgress}
              urlParseError={knowledgeProps.urlParseError}
              urlParseSuccess={knowledgeProps.urlParseSuccess}
            />
          )}

          {panelView === 'tools' && (
            <ToolsPanel
              webSearchEnabled={knowledgeProps.webSearchEnabled}
              onToggleWebSearch={knowledgeProps.onToggleWebSearch}
            />
          )}

          {panelView === 'prompts' && (
            <PromptsPanel onPromptSelect={onPromptSelect} onOpenSettings={knowledgeProps.onOpenSettings} />
          )}
        </div>
      </div>

      {/* 底部固定区域 */}
      {panelView === 'memory' && memories.length > 0 && (
        <div className="px-4 md:px-5 py-3 md:py-4 border-t border-border/40 bg-background/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearMemories}
            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {t('memory.clearAll')}
          </Button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { 
            opacity: 0; 
            transform: translateX(-20px); 
          }
          to { 
            opacity: 1; 
            transform: translateX(0); 
          }
        }
        @keyframes fadeInUp {
          from { 
            opacity: 0; 
            transform: translateY(8px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        @keyframes scaleIn {
          from { 
            opacity: 0; 
            transform: scale(0.5); 
          }
          to { 
            opacity: 1; 
            transform: scale(1); 
          }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .animate-scale-in {
          animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
    </>
  );
}
