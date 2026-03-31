import { useState, useEffect } from 'react';
import { Brain, Search, FileText, Mic, ChevronRight, Globe, FileSearch, Presentation, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SuggestedPrompt } from '../../types';
import type { StyleConfig } from '../../hooks/useStyleConfig';
import { LogoGenerator } from './LogoGenerator';

interface WelcomeScreenProps {
  onSelectPrompt: (text: string) => void;
  onOpenSkillsPanel: () => void;
  brandConfig: StyleConfig;
}

const PINNED_SKILLS_KEY = 'legendagent_pinned_skills';

const skillConfigs: Record<string, { icon: LucideIcon; iconBg: string }> = {
  deepThinking: { icon: Brain, iconBg: 'bg-violet-500/20' },
  deepResearch: { icon: Search, iconBg: 'bg-blue-500/20' },
  readDoc: { icon: FileText, iconBg: 'bg-emerald-500/20' },
  meetingMinutes: { icon: Mic, iconBg: 'bg-orange-500/20' },
  webSearch: { icon: Globe, iconBg: 'bg-cyan-500/20' },
  docSearch: { icon: FileSearch, iconBg: 'bg-amber-500/20' },
  pptGenerate: { icon: Presentation, iconBg: 'bg-pink-500/20' },
};

const defaultSkills = ['deepThinking', 'deepResearch', 'readDoc', 'meetingMinutes'];

export function WelcomeScreen({ onSelectPrompt, onOpenSkillsPanel, brandConfig }: WelcomeScreenProps) {
  const { t, i18n } = useTranslation();
  const [displaySkills, setDisplaySkills] = useState<string[]>(defaultSkills);

  // 根据当前语言选择显示的文本
  const isEnglish = i18n.language === 'en-US';
  const displayWelcomeTitle = isEnglish ? (brandConfig.welcome.titleEn || brandConfig.welcome.title) : brandConfig.welcome.title;
  const displayWelcomeSubtitle = isEnglish ? (brandConfig.welcome.subtitleEn || brandConfig.welcome.subtitle) : brandConfig.welcome.subtitle;

  // 响应式检测
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadPinnedSkills = () => {
      try {
        const saved = localStorage.getItem(PINNED_SKILLS_KEY);
        if (saved) {
          const pinned = JSON.parse(saved);
          if (pinned.length > 0) {
            const display = [...pinned.slice(0, 4)];
            const remaining = defaultSkills.filter(s => !display.includes(s));
            while (display.length < 4 && remaining.length > 0) {
              display.push(remaining.shift()!);
            }
            setDisplaySkills(display);
          } else {
            setDisplaySkills(defaultSkills);
          }
        }
      } catch {
        // ignore
      }
    };

    loadPinnedSkills();

    window.addEventListener('pinned-skills-change', loadPinnedSkills);
    return () => {
      window.removeEventListener('pinned-skills-change', loadPinnedSkills);
    };
  }, []);

  const suggestedPrompts: SuggestedPrompt[] = displaySkills.map(skillId => {
    const config = skillConfigs[skillId] || { icon: Brain, iconBg: 'bg-violet-500/20' };
    return {
      icon: config.icon,
      text: t(`welcome.prompts.${skillId}`),
      desc: t(`welcome.prompts.${skillId}Desc`),
      iconBg: config.iconBg,
    };
  });

  // 使用样式配置的颜色
  const primaryColor = brandConfig.colors.primary;
  const secondaryColor = brandConfig.colors.secondary;

  // 响应式 Logo 尺寸
  const welcomeLogoSize = brandConfig.logo.welcomeSize || 80;
  const currentLogoSize = isMobile ? welcomeLogoSize * 0.6 : welcomeLogoSize;
  const blurSize = isMobile ? 6 : 20;
  const paddingSize = isMobile ? 8 : 24;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 md:px-6 py-4 md:py-12 overflow-y-auto">
      <div className="text-center mb-4 md:mb-12">
        <div
          className="relative inline-flex mb-2 md:mb-6 animate-float"
          style={{ padding: paddingSize }}
        >
          <div
            className="absolute rounded-lg opacity-40 animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              filter: `blur(${blurSize}px)`,
              inset: 0,
            }}
          />
          <div
            className="absolute rounded-lg opacity-20"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              filter: `blur(${blurSize - 4}px)`,
              animation: 'spin 8s linear infinite',
              inset: 0,
            }}
          />
          <div
            className="relative flex items-center justify-center rounded-lg shadow-2xl"
            style={{
              width: currentLogoSize,
              height: currentLogoSize,
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              boxShadow: `0 25px 50px -12px ${primaryColor}40`,
            }}
          >
            {brandConfig.logo.type === 'generated' && brandConfig.logo.generated ? (
              <LogoGenerator config={{ 
                ...brandConfig.logo.generated, 
                size: currentLogoSize
              }} />
            ) : brandConfig.logo.customUrl ? (
              <img src={brandConfig.logo.customUrl} alt="Logo" className="h-6 w-6 md:h-10 md:w-10 object-contain" />
            ) : (
              <Brain className="h-6 w-6 md:h-10 md:w-10 text-white animate-shimmer" />
            )}
          </div>
        </div>
        <h2
          className="mb-1 md:mb-3 text-xl md:text-4xl font-bold bg-clip-text text-transparent animate-gradient-x"
          style={{ backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
        >
          {displayWelcomeTitle}
        </h2>
        <p className="text-muted-foreground text-xs md:text-lg">{displayWelcomeSubtitle}</p>
      </div>

      {/* Suggested Prompts */}
      <div className="grid max-w-3xl grid-cols-1 sm:grid-cols-2 gap-2 md:gap-4 w-full px-2 md:px-0">
        {suggestedPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onSelectPrompt(prompt.text)}
            className="group relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm p-3 md:p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
            style={{ 
              animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`,
              borderColor: `color-mix(in srgb, ${primaryColor} 30%, transparent)`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `color-mix(in srgb, ${primaryColor} 30%, transparent)`;
              e.currentTarget.style.boxShadow = `0 20px 25px -5px ${primaryColor}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `linear-gradient(135deg, ${primaryColor}05, ${secondaryColor}05)` }}
            />
            <div className="relative flex items-start gap-2 md:gap-4">
              <div
                className="flex-shrink-0 p-1.5 md:p-3 rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)` }}
              >
                <prompt.icon className="h-4 w-4 md:h-5 md:w-5" color={primaryColor} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate text-xs md:text-base">{prompt.text}</p>
                <p className="text-[10px] md:text-sm text-muted-foreground mt-0.5 md:mt-1">{prompt.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* More Skills Button */}
      <button
        onClick={onOpenSkillsPanel}
        className="mt-3 md:mt-6 flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2.5 rounded-full text-[10px] md:text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg"
        style={{ 
          animation: `fadeInUp 0.5s ease-out 0.5s both`,
          background: `linear-gradient(135deg, ${primaryColor}10, ${secondaryColor}10)`,
          borderColor: `color-mix(in srgb, ${primaryColor} 20%, transparent)`,
          color: primaryColor,
          borderWidth: '1px',
        }}
      >
        <Wrench className="h-3.5 w-3.5 md:h-4 md:w-4" />
        <span>{t('welcome.moreSkills')}</span>
        <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 animate-pulse" />
      </button>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
        .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
