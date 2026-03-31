import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RotateCcw, Check, Palette, Type, Image, Sparkles, MessageSquarePlus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { StyleConfig } from '../../hooks/useStyleConfig';
import { LogoGenerator, LogoPreviewGrid } from './LogoGenerator';

interface PromptItem {
  id: string;
  title: string;
  titleEn: string;
  prompt: string;
  promptEn: string;
  categoryId: string;
}

interface PromptCategory {
  id: string;
  name: string;
  nameEn: string;
  prompts: PromptItem[];
}

const CUSTOM_PROMPTS_KEY = 'legendagent_custom_prompts_v2';

interface StyleConfigPanelProps {
  config: StyleConfig;
  onSave: (config: Partial<StyleConfig>) => void;
  onReset: () => void;
  onClose: () => void;
}

type Tab = 'general' | 'logo' | 'colors' | 'welcome' | 'prompts';

export function StyleConfigPanel({ config, onSave, onReset, onClose }: StyleConfigPanelProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [localConfig, setLocalConfig] = useState<StyleConfig>(config);
  
  // 提示词管理状态
  const [promptCategories, setPromptCategories] = useState<PromptCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState({ name: '', nameEn: '' });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [newPrompt, setNewPrompt] = useState({ title: '', titleEn: '', prompt: '', promptEn: '' });

  // 加载自定义提示词
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_PROMPTS_KEY);
      if (saved) {
        setPromptCategories(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // 保存自定义提示词
  const savePromptCategories = (categories: PromptCategory[]) => {
    setPromptCategories(categories);
    localStorage.setItem(CUSTOM_PROMPTS_KEY, JSON.stringify(categories));
  };

  // 添加分类
  const handleAddCategory = () => {
    if (!newCategoryName.name) return;
    const category: PromptCategory = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.name,
      nameEn: newCategoryName.nameEn || newCategoryName.name,
      prompts: [],
    };
    savePromptCategories([...promptCategories, category]);
    setNewCategoryName({ name: '', nameEn: '' });
    setShowAddCategory(false);
    setExpandedCategories(prev => new Set([...prev, category.id]));
  };

  // 删除分类
  const handleDeleteCategory = (categoryId: string) => {
    savePromptCategories(promptCategories.filter(c => c.id !== categoryId));
  };

  // 添加提示词
  const handleAddPrompt = (categoryId: string) => {
    if (!newPrompt.title || !newPrompt.prompt) return;
    const prompt: PromptItem = {
      id: `prompt-${Date.now()}`,
      title: newPrompt.title,
      titleEn: newPrompt.titleEn || newPrompt.title,
      prompt: newPrompt.prompt,
      promptEn: newPrompt.promptEn || newPrompt.prompt,
      categoryId,
    };
    const updated = promptCategories.map(cat =>
      cat.id === categoryId ? { ...cat, prompts: [...cat.prompts, prompt] } : cat
    );
    savePromptCategories(updated);
    setNewPrompt({ title: '', titleEn: '', prompt: '', promptEn: '' });
    setEditingCategoryId(null);
  };

  // 删除提示词
  const handleDeletePrompt = (categoryId: string, promptId: string) => {
    const updated = promptCategories.map(cat =>
      cat.id === categoryId ? { ...cat, prompts: cat.prompts.filter(p => p.id !== promptId) } : cat
    );
    savePromptCategories(updated);
  };

  // 切换分类展开
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const isEnglish = i18n.language === 'en-US';

  const handleSave = () => {
    onSave(localConfig);
    onClose();
  };

  const updateConfig = <K extends keyof StyleConfig>(key: K, value: StyleConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateLogoConfig = (updates: Partial<NonNullable<StyleConfig['logo']['generated']>>) => {
    setLocalConfig(prev => ({
      ...prev,
      logo: {
        ...prev.logo,
        generated: {
          ...prev.logo.generated!,
          ...updates,
        },
      },
    }));
  };

  const updateColors = (key: keyof StyleConfig['colors'], value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const updateWelcome = (key: keyof StyleConfig['welcome'], value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      welcome: {
        ...prev.welcome,
        [key]: value,
      },
    }));
  };

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'general', label: t('styleConfig.tabs.general'), icon: Type },
    { id: 'logo', label: t('styleConfig.tabs.logo'), icon: Image },
    { id: 'colors', label: t('styleConfig.tabs.colors'), icon: Palette },
    { id: 'welcome', label: t('styleConfig.tabs.welcome'), icon: Sparkles },
    { id: 'prompts', label: t('styleConfig.tabs.prompts'), icon: MessageSquarePlus },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[600px] max-h-[90vh] bg-background rounded-2xl border border-border/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-gradient-to-r from-violet-500/5 to-purple-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('styleConfig.title')}</h2>
              <p className="text-xs text-muted-foreground">{t('styleConfig.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-violet-600 border-violet-500 dark:text-violet-400'
                  : 'text-foreground/70 border-transparent hover:text-foreground dark:text-foreground/70'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.name')}</label>
                  <input
                    type="text"
                    value={localConfig.name}
                    onChange={e => updateConfig('name', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="中文"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.nameEn')}</label>
                  <input
                    type="text"
                    value={localConfig.nameEn || ''}
                    onChange={e => updateConfig('nameEn', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="English"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.tagline')}</label>
                  <input
                    type="text"
                    value={localConfig.tagline}
                    onChange={e => updateConfig('tagline', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="中文"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.taglineEn')}</label>
                  <input
                    type="text"
                    value={localConfig.taglineEn || ''}
                    onChange={e => updateConfig('taglineEn', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="English"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.subtitle')}</label>
                  <input
                    type="text"
                    value={localConfig.subtitle}
                    onChange={e => updateConfig('subtitle', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="中文"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.subtitleEn')}</label>
                  <input
                    type="text"
                    value={localConfig.subtitleEn || ''}
                    onChange={e => updateConfig('subtitleEn', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="English"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.footerText')}</label>
                  <input
                    type="text"
                    value={localConfig.footerText}
                    onChange={e => updateConfig('footerText', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="中文"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.footerTextEn')}</label>
                  <input
                    type="text"
                    value={localConfig.footerTextEn || ''}
                    onChange={e => updateConfig('footerTextEn', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="English"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logo' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.logoType')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateConfig('logo', { ...localConfig.logo, type: 'generated' })}
                    className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors ${
                      localConfig.logo.type === 'generated'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                        : 'border-border/50 text-foreground hover:border-violet-500/50 hover:text-violet-600 dark:hover:text-violet-400'
                    }`}
                  >
                    {t('styleConfig.logoTypes.generated')}
                  </button>
                  <button
                    onClick={() => updateConfig('logo', { ...localConfig.logo, type: 'custom' })}
                    className={`flex-1 px-4 py-2.5 rounded-lg border transition-colors ${
                      localConfig.logo.type === 'custom'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                        : 'border-border/50 text-foreground hover:border-violet-500/50 hover:text-violet-600 dark:hover:text-violet-400'
                    }`}
                  >
                    {t('styleConfig.logoTypes.custom')}
                  </button>
                </div>
              </div>

              {localConfig.logo.type === 'generated' && localConfig.logo.generated && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">{t('styleConfig.fields.shape')}</label>
                    <div className="flex gap-2">
                      {(['circle', 'rounded', 'square', 'hexagon'] as const).map(shape => (
                        <button
                          key={shape}
                          onClick={() => updateLogoConfig({ shape })}
                          className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                            localConfig.logo.generated?.shape === shape
                              ? 'border-violet-500 bg-violet-500/10'
                              : 'border-border/50 hover:border-violet-500/50'
                          }`}
                        >
                          <LogoGenerator
                            config={{
                              primaryColor: localConfig.logo.generated?.primaryColor || '#8B5CF6',
                              secondaryColor: localConfig.logo.generated?.secondaryColor || '#A855F7',
                              shape,
                              icon: localConfig.logo.generated?.icon || 'brain',
                              gradient: true,
                              size: 32,
                            }}
                          />
                          <span className="text-xs capitalize text-foreground">{shape}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">{t('styleConfig.fields.icon')}</label>
                    <div className="flex gap-2">
                      {(['brain', 'search', 'sparkles', 'zap'] as const).map(icon => (
                        <button
                          key={icon}
                          onClick={() => updateLogoConfig({ icon })}
                          className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-colors ${
                            localConfig.logo.generated?.icon === icon
                              ? 'border-violet-500 bg-violet-500/10'
                              : 'border-border/50 hover:border-violet-500/50'
                          }`}
                        >
                          <LogoGenerator
                            config={{
                              primaryColor: localConfig.logo.generated?.primaryColor || '#8B5CF6',
                              secondaryColor: localConfig.logo.generated?.secondaryColor || '#A855F7',
                              shape: localConfig.logo.generated?.shape || 'rounded',
                              icon,
                              gradient: true,
                              size: 32,
                            }}
                          />
                          <span className="text-xs capitalize text-foreground">{icon}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 尺寸设置 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.sidebarSize')}</label>
                      <input
                        type="number"
                        value={localConfig.logo.sidebarSize || 40}
                        onChange={e => updateConfig('logo', { 
                          ...localConfig.logo, 
                          sidebarSize: parseInt(e.target.value) || 40 
                        })}
                        min={24}
                        max={80}
                        className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.welcomeSize')}</label>
                      <input
                        type="number"
                        value={localConfig.logo.welcomeSize || 80}
                        onChange={e => updateConfig('logo', { 
                          ...localConfig.logo, 
                          welcomeSize: parseInt(e.target.value) || 80 
                        })}
                        min={40}
                        max={160}
                        className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.iconSizeRatio')}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={localConfig.logo.generated?.iconSizeRatio ?? 0.5}
                        onChange={e => updateLogoConfig({ 
                          iconSizeRatio: parseFloat(e.target.value) || 0.5 
                        })}
                        min={0.3}
                        max={0.8}
                        className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">{t('styleConfig.fields.preview')}</label>
                    <LogoPreviewGrid
                      primaryColor={localConfig.logo.generated.primaryColor}
                      secondaryColor={localConfig.logo.generated.secondaryColor}
                    />
                  </div>
                </>
              )}

              {localConfig.logo.type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.customLogoUrl')}</label>
                  <input
                    type="text"
                    value={localConfig.logo.customUrl || ''}
                    onChange={e => updateConfig('logo', { ...localConfig.logo, customUrl: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                  />
                  {localConfig.logo.customUrl && (
                    <div className="mt-4 flex justify-center">
                      <img
                        src={localConfig.logo.customUrl}
                        alt="Logo Preview"
                        className="h-20 object-contain rounded-lg border border-border/50"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.primaryColor')}</label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={localConfig.colors.primary}
                    onChange={e => {
                      updateColors('primary', e.target.value);
                      if (localConfig.logo.generated) {
                        updateLogoConfig({ primaryColor: e.target.value });
                      }
                    }}
                    className="w-12 h-12 rounded-lg border border-border/50 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localConfig.colors.primary}
                    onChange={e => updateColors('primary', e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.secondaryColor')}</label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={localConfig.colors.secondary}
                    onChange={e => {
                      updateColors('secondary', e.target.value);
                      if (localConfig.logo.generated) {
                        updateLogoConfig({ secondaryColor: e.target.value });
                      }
                    }}
                    className="w-12 h-12 rounded-lg border border-border/50 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localConfig.colors.secondary}
                    onChange={e => updateColors('secondary', e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.accentColor')}</label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={localConfig.colors.accent}
                    onChange={e => updateColors('accent', e.target.value)}
                    className="w-12 h-12 rounded-lg border border-border/50 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={localConfig.colors.accent}
                    onChange={e => updateColors('accent', e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'welcome' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.welcomeTitle')}</label>
                  <input
                    type="text"
                    value={localConfig.welcome.title}
                    onChange={e => updateWelcome('title', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="中文"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.welcomeTitleEn')}</label>
                  <input
                    type="text"
                    value={localConfig.welcome.titleEn || ''}
                    onChange={e => updateWelcome('titleEn', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="English"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.welcomeSubtitle')}</label>
                  <input
                    type="text"
                    value={localConfig.welcome.subtitle}
                    onChange={e => updateWelcome('subtitle', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="中文"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('styleConfig.fields.welcomeSubtitleEn')}</label>
                  <input
                    type="text"
                    value={localConfig.welcome.subtitleEn || ''}
                    onChange={e => updateWelcome('subtitleEn', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-colors"
                    placeholder="English"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-foreground/70">{t('prompts.configDescription')}</p>
              </div>

              {/* 添加分类按钮 */}
              {!showAddCategory ? (
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="w-full py-2.5 rounded-lg border border-dashed border-border/50 hover:border-violet-500/50 text-sm text-foreground/60 hover:text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  <span>{t('prompts.addCategory')}</span>
                </button>
              ) : (
                <div className="p-3 rounded-lg border border-border/50 bg-accent/20 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder={t('prompts.categoryNamePlaceholder')}
                      value={newCategoryName.name}
                      onChange={e => setNewCategoryName({ ...newCategoryName, name: e.target.value })}
                      className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                    <input
                      type="text"
                      placeholder={t('prompts.categoryNameEnPlaceholder')}
                      value={newCategoryName.nameEn}
                      onChange={e => setNewCategoryName({ ...newCategoryName, nameEn: e.target.value })}
                      className="px-3 py-2 text-sm rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowAddCategory(false); setNewCategoryName({ name: '', nameEn: '' }); }}
                      className="flex-1 py-2 rounded-lg border border-border/50 text-foreground text-sm hover:bg-accent transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.name}
                      className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-sm hover:bg-violet-600 transition-colors disabled:opacity-50"
                    >
                      {t('common.add')}
                    </button>
                  </div>
                </div>
              )}

              {/* 分类列表 */}
              <div className="space-y-2">
                {promptCategories.map(category => (
                  <div key={category.id} className="rounded-lg border border-border/50 overflow-hidden">
                    {/* 分类标题 */}
                    <div className="flex items-center justify-between px-3 py-2.5 bg-accent/20">
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="flex items-center gap-2 flex-1"
                      >
                        {expandedCategories.has(category.id) ? (
                          <ChevronDown className="h-4 w-4 text-foreground/70" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-foreground/70" />
                        )}
                        <span className="font-medium text-sm text-foreground">
                          {isEnglish ? category.nameEn : category.name}
                        </span>
                        <span className="text-xs text-foreground/50">({category.prompts.length})</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>

                    {/* 提示词列表 */}
                    {expandedCategories.has(category.id) && (
                      <div className="border-t border-border/50">
                        {category.prompts.map(prompt => (
                          <div
                            key={prompt.id}
                            className="flex items-start justify-between px-3 py-2.5 border-b border-border/30 last:border-b-0 hover:bg-accent/10"
                          >
                            <div className="flex-1 min-w-0 mr-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {isEnglish ? prompt.titleEn : prompt.title}
                              </p>
                              <p className="text-xs text-foreground/60 truncate mt-0.5">
                                {isEnglish ? prompt.promptEn : prompt.prompt}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeletePrompt(category.id, prompt.id)}
                              className="p-1 rounded hover:bg-red-500/10 transition-colors flex-shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </button>
                          </div>
                        ))}

                        {/* 添加提示词 */}
                        {editingCategoryId === category.id ? (
                          <div className="p-3 bg-accent/10 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder={t('prompts.form.titlePlaceholder')}
                                value={newPrompt.title}
                                onChange={e => setNewPrompt({ ...newPrompt, title: e.target.value })}
                                className="px-2.5 py-1.5 text-sm rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                              />
                              <input
                                type="text"
                                placeholder={t('prompts.form.titleEnPlaceholder')}
                                value={newPrompt.titleEn}
                                onChange={e => setNewPrompt({ ...newPrompt, titleEn: e.target.value })}
                                className="px-2.5 py-1.5 text-sm rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                              />
                            </div>
                            <textarea
                              placeholder={t('prompts.form.promptPlaceholder')}
                              value={newPrompt.prompt}
                              onChange={e => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                              rows={2}
                            />
                            <textarea
                              placeholder={t('prompts.form.promptEnPlaceholder')}
                              value={newPrompt.promptEn}
                              onChange={e => setNewPrompt({ ...newPrompt, promptEn: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border/50 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setEditingCategoryId(null); setNewPrompt({ title: '', titleEn: '', prompt: '', promptEn: '' }); }}
                                className="flex-1 py-1.5 rounded-lg border border-border/50 text-foreground text-xs hover:bg-accent transition-colors"
                              >
                                {t('common.cancel')}
                              </button>
                              <button
                                onClick={() => handleAddPrompt(category.id)}
                                disabled={!newPrompt.title || !newPrompt.prompt}
                                className="flex-1 py-1.5 rounded-lg bg-violet-500 text-white text-xs hover:bg-violet-600 transition-colors disabled:opacity-50"
                              >
                                {t('common.add')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCategoryId(category.id)}
                            className="w-full py-2 text-xs text-foreground/60 hover:text-foreground hover:bg-accent/10 transition-colors flex items-center justify-center gap-1"
                          >
                            <MessageSquarePlus className="h-3 w-3" />
                            <span>{t('prompts.addPrompt')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {promptCategories.length === 0 && (
                  <div className="text-center py-8">
                    <MessageSquarePlus className="h-8 w-8 mx-auto mb-2 text-foreground/30" />
                    <p className="text-sm text-foreground/60">{t('prompts.noCategories')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/30">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{t('styleConfig.reset')}</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border/50 text-foreground hover:bg-accent transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 transition-colors shadow-lg shadow-violet-500/25"
            >
              <Check className="h-4 w-4" />
              <span>{t('styleConfig.save')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
