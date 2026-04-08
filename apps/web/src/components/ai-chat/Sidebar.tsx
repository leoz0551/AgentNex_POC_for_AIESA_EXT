import { useMemo, memo } from 'react';
import { Plus, MessageSquare, Brain, BookOpen, Search, Trash2, Moon, Sun, ChevronDown, Clock, Settings, X, ClipboardEdit, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@workspace/ui/components/button';
import type { SessionSummary, PanelView } from '../../types';
import { useRelativeTime } from '../../utils/timeFormat';
import { LogoGenerator } from './LogoGenerator';
import type { StyleConfig } from '../../hooks/useStyleConfig';

interface SidebarProps {
  sessions: SessionSummary[];
  currentSessionId: string | undefined;
  memoriesCount: number;
  knowledgeDocsCount: number;
  webSearchEnabled: boolean;
  sidebarOpen: boolean;
  isDark: boolean;
  panelView: PanelView;
  styleConfig: StyleConfig;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onToggleDark: () => void;
  onOpenPanel: (panel: PanelView) => void;
  onOpenFeedbackBoard: () => void;
  onOpenStyleConfig: () => void;
  onClose: () => void;
}

export const Sidebar = memo(function Sidebar({
  sessions,
  currentSessionId,
  memoriesCount,
  knowledgeDocsCount,
  webSearchEnabled,
  sidebarOpen,
  isDark,
  panelView,
  styleConfig,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
  onToggleDark,
  onOpenPanel,
  onOpenFeedbackBoard,
  onOpenStyleConfig,
  onClose,
}: SidebarProps) {
  const { t, i18n } = useTranslation();
  const formatRelativeTime = useRelativeTime();

  if (!sidebarOpen) return null;

  // 根据当前语言选择显示的文本
  const isEnglish = i18n.language === 'en-US';
  const displayName = isEnglish ? (styleConfig.nameEn || styleConfig.name) : styleConfig.name;
  const displayTagline = isEnglish ? (styleConfig.taglineEn || styleConfig.tagline) : styleConfig.tagline;

  // 动态按钮颜色 - 使用 useMemo 避免重复创建
  const buttonStyle = useMemo(() => ({
    background: `linear-gradient(135deg, ${styleConfig.colors.primary}, ${styleConfig.colors.secondary})`,
    boxShadow: `0 10px 25px -5px ${styleConfig.colors.primary}40`,
  }), [styleConfig.colors.primary, styleConfig.colors.secondary]);

  // 导航项 - 使用 useMemo 避免重复创建
  const navItems = useMemo(() => [
    { icon: MessageSquare, label: t('sidebar.sessions'), count: sessions.length, active: true, onClick: () => {} },
    { icon: Sparkles, label: t('sidebar.prompts'), key: 'prompts', onClick: () => onOpenPanel(panelView === 'prompts' ? 'none' : 'prompts') },
    // { icon: Brain, label: t('sidebar.memory'), count: memoriesCount, key: 'memory', onClick: () => onOpenPanel(panelView === 'memory' ? 'none' : 'memory') },
    { icon: BookOpen, label: t('sidebar.knowledge'), count: knowledgeDocsCount, key: 'knowledge', onClick: () => onOpenPanel(panelView === 'knowledge' ? 'none' : 'knowledge') },
    { icon: Search, label: t('sidebar.tools'), count: webSearchEnabled ? 1 : 0, countLabel: webSearchEnabled ? (i18n.language === 'zh-CN' ? '开' : 'On') : (i18n.language === 'zh-CN' ? '关' : 'Off'), key: 'tools', onClick: () => onOpenPanel(panelView === 'tools' ? 'none' : 'tools') },
  ], [t, sessions.length, memoriesCount, knowledgeDocsCount, webSearchEnabled, i18n.language, panelView, onOpenPanel]);

  const handleSessionClick = (id: string) => {
    onSwitchSession(id);
    // 只在移动端关闭 sidebar (宽度 < 768px)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
        onClick={onClose}
      />
      
      <aside className="fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-[280px] md:w-72 flex-shrink-0 border-r border-border/40 bg-background/80 backdrop-blur-xl transition-all duration-300 ease-out overflow-hidden shadow-xl md:shadow-none">
        <div className="flex h-full flex-col">
          {/* Logo & New Chat */}
          <div className="p-3 md:p-4 space-y-3 md:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="relative">
                  {styleConfig.logo.type === 'generated' && styleConfig.logo.generated ? (
                    <div className="absolute inset-0 blur-lg opacity-50" style={{ background: `linear-gradient(135deg, ${styleConfig.logo.generated.primaryColor}, ${styleConfig.logo.generated.secondaryColor})`, borderRadius: styleConfig.logo.generated.shape === 'circle' ? '50%' : styleConfig.logo.generated.shape === 'square' ? '0' : '12px' }} />
                  ) : null}
                  {styleConfig.logo.type === 'generated' && styleConfig.logo.generated ? (
                    <LogoGenerator config={{ 
                      ...styleConfig.logo.generated, 
                      size: styleConfig.logo.sidebarSize || 40 
                    }} />
                  ) : styleConfig.logo.customUrl ? (
                    <img src={styleConfig.logo.customUrl} alt="Logo" className="h-8 w-8 md:h-10 md:w-10 object-contain rounded-xl" />
                  ) : (
                    <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
                      <Brain className="h-4 w-4 md:h-5 md:w-5 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="font-semibold text-base md:text-lg" style={{ color: styleConfig.colors.primary }}>{displayName}</h1>
                  <p className="text-[9px] md:text-[10px] text-muted-foreground">{displayTagline}</p>
                </div>
              </div>
              {/* Mobile close button */}
              <button 
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent/50 transition-colors md:hidden"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <Button 
              onClick={onNewSession} 
              className="w-full h-10 md:h-11 justify-start gap-3 text-white transition-all duration-200 hover:scale-[1.02]"
              style={buttonStyle}
            >
              <Plus className="h-4 w-4" />
              <span className="font-medium text-sm md:text-base">{t('sidebar.newSession')}</span>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="space-y-1 px-2 md:px-3">
            {navItems.map((item) => (
              <button
                key={item.key || item.label}
                onClick={item.onClick}
                className={`group flex w-full items-center justify-between rounded-xl px-2.5 md:px-3 py-2 md:py-2.5 text-sm transition-all duration-200 ${
                  ('active' in item && item.active) || (item.key === 'memory' && panelView === 'memory') || (item.key === 'knowledge' && panelView === 'knowledge') || (item.key === 'tools' && panelView === 'tools') || (item.key === 'prompts' && panelView === 'prompts')
                    ? 'bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-700 dark:text-violet-300'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <div className={`p-1 md:p-1.5 rounded-lg transition-colors ${('active' in item && item.active) || (item.key === 'memory' && panelView === 'memory') || (item.key === 'knowledge' && panelView === 'knowledge') || (item.key === 'tools' && panelView === 'tools') || (item.key === 'prompts' && panelView === 'prompts') ? 'bg-violet-500/20' : 'group-hover:bg-accent'}`}>
                    <item.icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </div>
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.countLabel 
                      ? (item.countLabel === '开' || item.countLabel === 'On'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-muted text-muted-foreground')
                      : 'bg-violet-500/20 text-violet-600 dark:text-violet-400'
                  }`}>
                    {item.countLabel || item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Chat History */}
          <div className="mt-4 md:mt-6 flex-1 overflow-y-auto px-2 md:px-3 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            <div className="mb-2 md:mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('sidebar.history') || '历史记录'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="space-y-1 md:space-y-1.5">
              {sessions.map((session) => (
                <div key={session.id} onClick={() => handleSessionClick(session.id)} className={`group relative rounded-xl px-2.5 md:px-3 py-2 md:py-2.5 text-sm cursor-pointer transition-all duration-200 ${currentSessionId === session.id ? 'bg-gradient-to-r from-violet-500/15 to-purple-500/15 border border-violet-500/20' : 'hover:bg-accent/50 border border-transparent'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-2.5 min-w-0 flex-1">
                      <div className="p-1 rounded-md bg-violet-500/20 dark:bg-violet-500/30">
                        <MessageSquare className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0 text-violet-600 dark:text-violet-300" />
                      </div>
                      <span className="truncate font-medium text-foreground text-sm">{session.title}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }} className="flex-shrink-0 p-1 md:p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-accent/50 hover:bg-red-500/10 transition-all duration-200">
                      <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5 text-red-500 dark:text-red-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 ml-5 md:ml-6">
                    <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 text-muted-foreground/60" />
                    <span className="text-[10px] md:text-[11px] text-muted-foreground/70">{formatRelativeTime(session.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Profile */}
          <div className="border-t border-border/40 p-3 md:p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="relative">
                  <div className="h-8 w-8 md:h-9 md:w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs md:text-sm shadow-lg" style={{ background: `linear-gradient(135deg, ${styleConfig.colors.primary}, ${styleConfig.colors.secondary})`, boxShadow: `0 10px 25px -5px ${styleConfig.colors.primary}40` }}>A</div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-emerald-500 border-2 border-background" />
                </div>
                <div>
                  <p className="text-xs md:text-sm font-medium text-foreground">{t('sidebar.user')}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground">{t('sidebar.freePlan')}</p>
                </div>
              </div>
              <div className="flex gap-0.5 md:gap-1">
                <button onClick={onOpenStyleConfig} className="p-1.5 md:p-2 rounded-lg bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors dark:bg-accent/30 dark:hover:bg-accent/60" title={t('styleConfig.title')}>
                  <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </button>
                <button 
                  onClick={onOpenFeedbackBoard} 
                  className="p-1.5 md:p-2 rounded-lg bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors dark:bg-accent/30 dark:hover:bg-accent/60" 
                  title={t('sidebar.feedback') || 'Feedback Board'}
                >
                  <ClipboardEdit className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </button>
                <button onClick={onToggleDark} className="p-1.5 md:p-2 rounded-lg bg-accent/50 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors dark:bg-accent/30 dark:hover:bg-accent/60" title={isDark ? t('sidebar.lightMode') : t('sidebar.darkMode')}>
                  {isDark ? <Sun className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <Moon className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
