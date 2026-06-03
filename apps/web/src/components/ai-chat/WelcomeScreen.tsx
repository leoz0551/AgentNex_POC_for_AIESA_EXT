import { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { StyleConfig } from '../../hooks/useStyleConfig';
import { LogoGenerator } from './LogoGenerator';

interface WelcomeScreenProps {
  brandConfig: StyleConfig;
}

// Removed skills logic

export function WelcomeScreen({ brandConfig }: WelcomeScreenProps) {
  const { i18n } = useTranslation();
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isEnglish = i18n.language === 'en-US';
  const displayWelcomeTitle = isEnglish ? (brandConfig.welcome.titleEn || brandConfig.welcome.title) : brandConfig.welcome.title;
  const displayWelcomeSubtitle = isEnglish ? (brandConfig.welcome.subtitleEn || brandConfig.welcome.subtitle) : brandConfig.welcome.subtitle;
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

      {/* Removed Suggested Prompts and More Skills Button */}

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
