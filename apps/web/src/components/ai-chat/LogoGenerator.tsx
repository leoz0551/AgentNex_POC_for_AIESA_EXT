import { Brain, Search, Sparkles, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface LogoConfig {
  primaryColor: string;
  secondaryColor: string;
  shape: 'circle' | 'square' | 'rounded' | 'hexagon';
  icon: 'brain' | 'search' | 'sparkles' | 'zap' | 'custom';
  customIcon?: string;
  gradient: boolean;
  size?: number;
  iconSizeRatio?: number;
}

interface LogoGeneratorProps {
  config: LogoConfig;
  className?: string;
}

const shapeStyles: Record<string, string> = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-xl',
  hexagon: 'rounded-none', // 六边形需要特殊处理
};

const iconComponents: Record<string, LucideIcon> = {
  brain: Brain,
  search: Search,
  sparkles: Sparkles,
  zap: Zap,
};

export function LogoGenerator({ config, className = '' }: LogoGeneratorProps) {
  const size = config.size || 40;
  const iconSizeRatio = config.iconSizeRatio ?? 0.5;
  const iconSize = Math.round(size * iconSizeRatio);
  
  const IconComponent = config.icon === 'custom' 
    ? null 
    : iconComponents[config.icon] || Brain;

  const background = config.gradient
    ? `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})`
    : config.primaryColor;

  // 六边形 SVG 路径
  if (config.shape === 'hexagon') {
    return (
      <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0"
          style={{ width: size, height: size }}
        >
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={config.primaryColor} />
              <stop offset="100%" stopColor={config.secondaryColor} />
            </linearGradient>
          </defs>
          <polygon
            points="50,2 95,25 95,75 50,98 5,75 5,25"
            fill={config.gradient ? 'url(#logoGradient)' : config.primaryColor}
          />
        </svg>
        {IconComponent && (
          <div className="absolute inset-0 flex items-center justify-center">
            <IconComponent 
              className="text-white" 
              style={{ width: iconSize, height: iconSize }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center shadow-lg ${shapeStyles[config.shape]} ${className}`}
      style={{
        width: size,
        height: size,
        background,
        boxShadow: `0 10px 25px -5px ${config.primaryColor}40`,
      }}
    >
      {IconComponent && (
        <IconComponent 
          className="text-white" 
          style={{ width: iconSize, height: iconSize }}
        />
      )}
      {config.icon === 'custom' && config.customIcon && (
        <img 
          src={config.customIcon} 
          alt="Logo" 
          style={{ width: iconSize, height: iconSize }}
          className="object-contain"
        />
      )}
    </div>
  );
}

// 生成 Logo 预览网格
export function LogoPreviewGrid({ primaryColor, secondaryColor }: { primaryColor: string; secondaryColor: string }) {
  const shapes: Array<'circle' | 'square' | 'rounded' | 'hexagon'> = ['circle', 'rounded', 'square', 'hexagon'];
  const icons: Array<'brain' | 'search' | 'sparkles' | 'zap'> = ['brain', 'search', 'sparkles', 'zap'];

  return (
    <div className="grid grid-cols-4 gap-4">
      {shapes.map(shape => (
        icons.map(icon => (
          <div key={`${shape}-${icon}`} className="flex flex-col items-center gap-2">
            <LogoGenerator
              config={{
                primaryColor,
                secondaryColor,
                shape,
                icon,
                gradient: true,
                size: 48,
              }}
            />
            <span className="text-[10px] text-muted-foreground capitalize">{shape}</span>
          </div>
        ))
      ))}
    </div>
  );
}
