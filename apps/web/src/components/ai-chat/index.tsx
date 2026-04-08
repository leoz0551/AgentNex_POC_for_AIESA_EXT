import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { MessageSquare, Loader2, Zap, X, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSessions, useMemory, useKnowledge, useChat, useStyleConfig } from '../../hooks';
import type { PanelView } from '../../types';
import { Sidebar } from './Sidebar';
import { WelcomeScreen } from './WelcomeScreen';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { FeedbackDialog } from './FeedbackDialog';

// 懒加载面板组件 - 只在需要时才加载
const RightPanel = lazy(() => import('./RightPanel').then(m => ({ default: m.RightPanel })));
const SkillsPanel = lazy(() => import('./SkillsPanel').then(m => ({ default: m.SkillsPanel })));
const StyleConfigPanel = lazy(() => import('./StyleConfigPanel').then(m => ({ default: m.StyleConfigPanel })));
const FeedbackBoard = lazy(() => import('./FeedbackBoard').then(m => ({ default: m.FeedbackBoard })));

export function AIChat() {
  const { t } = useTranslation();

  // 页面视图状态: 'chat' | 'feedback'
  const [pageView, setPageView] = useState<'chat' | 'feedback'>('chat');

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
    feedbackDialogOpen,
    submitDetailedFeedback,
    closeFeedbackDialog,
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

  // 处理技能选择
  const handleSkillSelect = useCallback((_skillId: string, prompt: string) => {
    setInputValue(prompt);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, [setInputValue, textareaRef]);

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

  // AIChat render

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
          onNewSession={() => {
            setPageView('chat');
            createNewSession(t('chat.newChat'));
          }}
          onSwitchSession={(id) => {
            setPageView('chat');
            switchSession(id);
          }}
          onDeleteSession={deleteSession}
          onToggleDark={toggleDark}
          onOpenPanel={openPanel}
          onOpenFeedbackBoard={() => setPageView('feedback')}
          onOpenStyleConfig={() => setBrandSettingsOpen(true)}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      {pageView === 'feedback' ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
          <FeedbackBoard />
        </Suspense>
      ) : (
        <>
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

          <main className="flex flex-1 flex-col min-w-0 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ backgroundColor: styleConfig.colors.primary }} />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ backgroundColor: styleConfig.colors.secondary }} />
            </div>

            {/* Header */}
            <header className="relative flex items-center justify-between border-b border-border/40 px-4 md:px-6 py-3 md:py-4 bg-background/80 backdrop-blur-xl z-10">
              <div className="flex items-center gap-3 md:gap-4">
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)} 
                  className="p-2 md:p-2.5 rounded-xl bg-accent/50 hover:bg-accent/80 transition-all duration-200"
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
                    <Loader2 className="h-10 w-10 animate-spin" style={{ color: styleConfig.colors.primary }} />
                    <p className="text-sm text-muted-foreground animate-pulse">{t('common.loading')}</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <WelcomeScreen 
                  onSelectPrompt={setInputValue} 
                  onOpenSkillsPanel={() => setSkillsPanelOpen(true)}
                  brandConfig={styleConfig}
                />
              ) : (
                <MessageList 
                  messages={messages} 
                  isLoading={isLoading} 
                  messagesEndRef={messagesEndRef}
                  copiedId={copiedId}
                  onCopy={copyToClipboard}
                  onRegenerate={handleRegenerate}
                  onFeedback={handleFeedback}
                />
              )}
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
        </>
      )}

      {/* Feedback Dialog */}
      <FeedbackDialog
        isOpen={feedbackDialogOpen}
        onClose={closeFeedbackDialog}
        onSubmit={submitDetailedFeedback}
      />

      {/* Skills Studio Panel */}
      {skillsPanelOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setSkillsPanelOpen(false)} />
          <div ref={resizeRef} className="fixed md:relative inset-y-0 right-0 z-50 md:z-auto w-full sm:w-80 md:border-l border-border/60 bg-background/80 backdrop-blur-xl flex flex-col shadow-xl" style={{ width: skillsPanelWidth }}>
            <div className={`hidden md:block absolute left-0 top-0 bottom-0 w-px cursor-ew-resize group z-10 ${isResizing ? 'bg-violet-500/50' : 'hover:bg-violet-500/30'}`} onMouseDown={handleMouseDown}>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-5 w-5 text-violet-500" />
              </div>
            </div>
            <div className="relative overflow-hidden px-4 md:px-5 py-3 md:py-4 border-b border-border/40">
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <Zap className="h-5 w-5 text-violet-500" />
                  <h2 className="text-base md:text-lg font-bold">{t('skills.studio')}</h2>
                </div>
                <button onClick={() => setSkillsPanelOpen(false)} className="p-2 rounded-full hover:bg-accent transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 md:px-4 py-3 md:py-4">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
                <SkillsPanel onSkillSelect={handleSkillSelect} />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {/* Style Config Panel */}
      {brandSettingsOpen && (
        <Suspense fallback={null}>
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
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}
