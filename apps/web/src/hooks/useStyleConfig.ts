import { useState, useEffect, useCallback } from 'react';

export interface StyleConfig {
  // Agent 信息
  name: string;
  nameEn?: string;
  tagline: string;
  taglineEn?: string;
  subtitle: string;
  subtitleEn?: string;
  
  // Logo 配置
  logo: {
    type: 'generated' | 'custom';
    customUrl?: string;
    // 生成器配置
    generated?: {
      primaryColor: string;
      secondaryColor: string;
      shape: 'circle' | 'square' | 'rounded' | 'hexagon';
      icon: 'brain' | 'search' | 'sparkles' | 'zap' | 'custom';
      customIcon?: string;
      gradient: boolean;
      // 图标大小比例 (相对于容器)
      iconSizeRatio?: number;
    };
    // 侧边栏 logo 尺寸
    sidebarSize?: number;
    // 欢迎页 logo 尺寸
    welcomeSize?: number;
  };
  
  // 主题色
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  
  // 欢迎页
  welcome: {
    title: string;
    titleEn?: string;
    subtitle: string;
    subtitleEn?: string;
  };
  
  // 底部文字
  footerText: string;
  footerTextEn?: string;
}

const DEFAULT_CONFIG: StyleConfig = {
  name: 'AgentNex',
  nameEn: 'AgentNex',
  tagline: '智能对话 · 无限可能',
  taglineEn: 'Smart Chat · Infinite Possibilities',
  subtitle: 'AI 企业搜索智能体',
  subtitleEn: 'AI Enterprise Search Agent',
  
  logo: {
    type: 'generated',
    sidebarSize: 40,
    welcomeSize: 80,
    generated: {
      primaryColor: '#8B5CF6',
      secondaryColor: '#A855F7',
      shape: 'rounded',
      icon: 'brain',
      gradient: true,
      iconSizeRatio: 0.5,
    },
  },
  
  colors: {
    primary: '#8B5CF6',
    secondary: '#A855F7',
    accent: '#EC4899',
  },
  
  welcome: {
    title: '有什么可以帮你？',
    titleEn: 'How can I help you?',
    subtitle: '选择一个话题开始，或直接输入你的问题',
    subtitleEn: 'Choose a topic to start, or type your question directly',
  },
  
  footerText: 'AI 可能会生成不准确的信息，请注意甄别',
  footerTextEn: 'AI may generate inaccurate information, please verify',
};

const STORAGE_KEY = 'legendagent_style_config';

export function useStyleConfig() {
  const [config, setConfig] = useState<StyleConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // 从 localStorage 加载配置
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load style config:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存配置
  const saveConfig = useCallback((newConfig: Partial<StyleConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save style config:', error);
      }
      return updated;
    });
  }, []);

  // 重置为默认
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset style config:', error);
    }
  }, []);

  // 应用特定客户的配置
  const applyClientConfig = useCallback((clientName: string) => {
    const clientConfigs: Record<string, Partial<StyleConfig>> = {
      'AIESA': {
        name: 'AIESA',
        nameEn: 'AIESA',
        tagline: '探索 SSG 的 AI 企业搜索智能体',
        taglineEn: 'Explore SSG with AI Enterprise Search Agent',
        subtitle: 'AI 企业搜索智能体',
        subtitleEn: 'AI Enterprise Search Agent',
        logo: {
          type: 'generated',
          generated: {
            primaryColor: '#4F46E5',
            secondaryColor: '#7C3AED',
            shape: 'circle',
            icon: 'search',
            gradient: true,
          },
        },
        colors: {
          primary: '#4F46E5',
          secondary: '#7C3AED',
          accent: '#EC4899',
        },
        welcome: {
          title: '欢迎来到 AIESA',
          titleEn: 'Welcome to AIESA',
          subtitle: '探索 SSG 的 AI 企业搜索智能体',
          subtitleEn: 'Explore SSG with AI Enterprise Search Agent',
        },
      },
    };

    const clientConfig = clientConfigs[clientName];
    if (clientConfig) {
      saveConfig(clientConfig);
    }
  }, [saveConfig]);

  return {
    config,
    isLoading,
    saveConfig,
    resetConfig,
    applyClientConfig,
  };
}
