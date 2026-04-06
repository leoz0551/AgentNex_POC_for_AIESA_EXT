import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { MessageSquare, Loader2, Zap, X, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSessions, useMemory, useKnowledge, useChat, useStyleConfig } from '../../hooks';
import type { PanelView } from '../../types';
import { Sidebar } from './Sidebar';
import { WelcomeScreen } from './WelcomeScreen';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';

// 懒加载面板组件 - 只在需要时才加载
const RightPanel = lazy(() => import('./RightPanel').then(m => ({ default: m.RightPanel })));
const SkillsPanel = lazy(() => import('./SkillsPanel').then(m => ({ default: m.SkillsPanel })));
const StyleConfigPanel = lazy(() => import('./StyleConfigPanel').then(m => ({ default: m.StyleConfigPanel })));

export function AIChat() {
  const { t } = useTranslation();

  // UI 状态 - PC端默认展开，移动端默认关闭
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768; // md breakpoint
    }
    return true; // SSR时默认PC端
  });
  const [isDark, setIsDark] = useState(false);
  const [panelView, setPanelView] = useState<PanelView>('none');
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [skillsPanelOpen, setSkillsPanelOpen] = useState(false);
  const [skillsPanelWidth, setSkillsPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [brandSettingsOpen, setBrandSettingsOpen] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);

  // 样式配置
  const { config: styleConfig, saveConfig: saveStyleConfig, resetConfig: resetStyleConfig } = useStyleConfig();

  // 业务 Hooks
  const {
    sessions,
    currentSession,
    setCurrentSession,
    loadingSession,
    loadSessions,
    createNewSession,
    deleteSession,
    switchSession,
  } = useSessions();

  const {
    memories,
    loadMemories,
    deleteMemory,
    clearMemories,
    error: memoryError,
    loading: memoryLoading,
  } = useMemory();

  const {
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
  } = useKnowledge();

  const {
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
  } = useChat({
    currentSession,
    setCurrentSession,
    loadSessions,
    selectedSkillId,
    onClearSkill: () => setSelectedSkillId(null),
    webSearchEnabled,
  });

  // 加载面板数据
  useEffect(() => {
    if (panelView === 'memory') loadMemories();
    if (panelView === 'knowledge') {
      loadKnowledgeDocs();
      loadKnowledgeStats();
    }
  }, [panelView, loadMemories, loadKnowledgeDocs, loadKnowledgeStats]);

  // 主题切换
  const toggleDark = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  // 打开面板
  const openPanel = useCallback((panel: PanelView) => {
    setPanelView(panel);
  }, []);

  // 处理技能选择
  const handleSkillSelect = useCallback((skillId: string, _prompt: string) => {
    setSelectedSkillId(skillId);
    // 重置输入框，让用户自己输入内容
    setInputValue(''); 
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, [setInputValue, textareaRef]);

  // 处理提示词选择 - 自动发送消息
  const handlePromptSelect = useCallback((prompt: string) => {
    setSelectedSkillId(null); // 选择提示词时清除已选技能
    setInputValue(prompt);
    setPanelView('none'); // 关闭面板
    // 短暂延迟后自动提交
    setTimeout(() => {
      handleSubmit();
    }, 100);
  }, [setInputValue, handleSubmit]);

  // 拖拽调整 Skills Panel 宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const container = resizeRef.current.parentElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      
      const minWidth = 280;
      const maxWidth = 500;
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      
      setSkillsPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div className={`flex h-screen transition-colors duration-300 ${isDark ? 'dark bg-[#0a0a0f]' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100'}`}>
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSession?.id}
          memoriesCount={memories.length}
          knowledgeDocsCount={knowledgeDocs.length}
          webSearchEnabled={webSearchEnabled}
          sidebarOpen={sidebarOpen}
          isDark={isDark}
          panelView={panelView}
          styleConfig={styleConfig}
          onNewSession={() => createNewSession(t('chat.newChat'))}
          onSwitchSession={switchSession}
          onDeleteSession={deleteSession}
          onToggleDark={toggleDark}
          onOpenPanel={openPanel}
          onOpenStyleConfig={() => setBrandSettingsOpen(true)}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Right Panel - 懒加载 */}
      <Suspense fallback={null}>
        <RightPanel
          panelView={panelView}
          onClose={() => setPanelView('none')}
          memories={memories}
          onDeleteMemory={deleteMemory}
          onClearMemories={clearMemories}
          memoryError={memoryError}
          memoryLoading={memoryLoading}
          knowledgeDocs={knowledgeDocs}
          knowledgeStats={knowledgeStats}
          knowledgeSearchQuery={knowledgeSearchQuery}
          setKnowledgeSearchQuery={setKnowledgeSearchQuery}
          knowledgeSearchResults={knowledgeSearchResults}
          showAddKnowledge={showAddKnowledge}
          setShowAddKnowledge={setShowAddKnowledge}
          newUrl={newUrl}
          setNewUrl={setNewUrl}
          newTextName={newTextName}
          setNewTextName={setNewTextName}
          newTextContent={newTextContent}
          setNewTextContent={setNewTextContent}
          fileInputRef={fileInputRef}
          onFileUpload={handleFileUpload}
          onKnowledgeSearch={handleKnowledgeSearch}
          onAddUrl={handleAddUrl}
          onAddText={handleAddText}
          onDeleteDocument={handleDeleteDocument}
          onClearKnowledge={handleClearKnowledge}
          uploading={uploading}
          uploadProgress={uploadProgress}
          uploadError={uploadError}
          uploadSuccess={uploadSuccess}
          urlParsing={urlParsing}
          urlParseProgress={urlParseProgress}
          urlParseError={urlParseError}
          urlParseSuccess={urlParseSuccess}
          webSearchEnabled={webSearchEnabled}
          onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
          onPromptSelect={handlePromptSelect}
          onOpenSettings={() => setBrandSettingsOpen(true)}
        />
      </Suspense>

      {/* Main Content */}
      <main className="flex flex-1 flex-col min-w-0 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: `${styleConfig.colors.primary}10` }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl" style={{ backgroundColor: `${styleConfig.colors.secondary}10` }} />
        </div>

        {/* Header */}
        <header className="relative flex items-center justify-between border-b border-border/40 px-4 md:px-6 py-3 md:py-4 bg-background/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3 md:gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="p-2 md:p-2.5 rounded-xl bg-accent/50 hover:bg-accent/80 transition-all duration-200 hover:scale-105 active:scale-95 dark:bg-accent/40 dark:hover:bg-accent/60"
            >
              <MessageSquare className="h-5 w-5 text-foreground" />
            </button>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50" />
              <div>
                <h1 className="text-base md:text-lg font-semibold tracking-tight truncate max-w-[180px] md:max-w-none">{currentSession?.title || t('chat.newChat')}</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">{messages.length > 0 ? t('chat.totalMessages', { count: messages.length }) : t('chat.startNewChat')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="relative flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {loadingSession ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl animate-pulse" style={{ backgroundColor: `${styleConfig.colors.primary}20` }} />
                  <Loader2 className="relative h-10 w-10 animate-spin" style={{ color: styleConfig.colors.primary }} />
                </div>
                <p className="text-sm text-muted-foreground animate-pulse">{t('common.loading')}</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <WelcomeScreen 
              onSkillSelect={handleSkillSelect}
              onOpenSkillsPanel={() => setSkillsPanelOpen(true)}
              brandConfig={styleConfig}
            />
          ) : (
            <MessageList
              messages={messages}
              isLoading={isLoading}
              copiedId={copiedId}
              messagesEndRef={messagesEndRef}
              onCopy={copyToClipboard}
              onRegenerate={handleRegenerate}
              onFeedback={handleFeedback}
            />
          )}
        </div>

        {/* Input Area */}
        <div className="relative z-10">
          <InputArea
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            inputFocused={inputFocused}
            setInputFocused={setInputFocused}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
            onSubmit={handleSubmit}
            onFileUpload={handleFileUpload}
            onSkillSelect={handleSkillSelect}
            selectedSkillId={selectedSkillId}
            onClearSkill={() => setSelectedSkillId(null)}
            styleConfig={styleConfig}
          />
        </div>
      </main>

      {/* Skills Studio Panel */}
      {skillsPanelOpen && (
        <>
          {/* Mobile overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSkillsPanelOpen(false)}
          />
          
          <div 
            ref={resizeRef}
            className="fixed md:relative inset-y-0 right-0 z-50 md:z-auto w-full sm:w-80 md:border-l border-border/60 bg-background/80 backdrop-blur-xl flex flex-col shadow-[inset_1px_0_0_0_rgba(0,0,0,0.05)] dark:shadow-[inset_1px_0_0_0_rgba(255,255,255,0.05)] relative"
            style={{
              width: skillsPanelWidth,
              animation: 'slideInFromRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div
              className={`hidden md:block absolute left-0 top-0 bottom-0 w-px cursor-ew-resize group z-10 ${
                isResizing ? 'bg-violet-500/50' : 'hover:bg-violet-500/30'
              }`}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-5 w-5 text-violet-500" />
              </div>
            </div>
            
            <div className="relative overflow-hidden px-4 md:px-5 py-3 md:py-4 border-b border-border/40">
              <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${styleConfig.colors.primary}10, ${styleConfig.colors.secondary}10)` }} />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/50" />
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  <div className="relative">
                    <div className="absolute inset-0 rounded-lg blur-lg opacity-40 animate-pulse" style={{ background: `linear-gradient(135deg, ${styleConfig.colors.primary}, ${styleConfig.colors.secondary})` }} />
                    <div className="relative flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg shadow-lg" style={{ background: `linear-gradient(135deg, ${styleConfig.colors.primary}, ${styleConfig.colors.secondary})`, boxShadow: `0 10px 25px -5px ${styleConfig.colors.primary}40` }}>
                      <Zap className="h-4 w-4 md:h-5 md:w-5 text-white" />
                    </div>
                  </div>
                  <h2 className="text-base md:text-lg font-bold bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(135deg, ${styleConfig.colors.primary}, ${styleConfig.colors.secondary})` }}>
                    {t('skills.studio')}
                  </h2>
                </div>
                
                <button 
                  onClick={() => setSkillsPanelOpen(false)} 
                  className="relative p-2 md:p-2.5 rounded-full bg-gradient-to-r from-background/80 to-background/60 border border-border/50 hover:border-violet-500/30 transition-all duration-300 hover:scale-110 active:scale-95 hover:shadow-lg hover:shadow-violet-500/10 dark:hover:border-violet-400/40"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                <SkillsPanel onSkillSelect={handleSkillSelect} />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {/* Style Config Panel - 懒加载 */}
      {brandSettingsOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <StyleConfigPanel
            config={styleConfig}
            onSave={saveStyleConfig}
            onReset={resetStyleConfig}
            onClose={() => setBrandSettingsOpen(false)}
          />
        </Suspense>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInFromRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: oklch(0.7 0 0 / 0.3); border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: oklch(0.5 0 0 / 0.5); }
        .writing-mode-vertical { writing-mode: vertical-rl; }
      `}</style>
    </div>
  );
}
