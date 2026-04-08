import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Upload, Globe, X, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@workspace/ui/components/button';
import { languages } from '../../i18n';
import type { StyleConfig } from '../../hooks/useStyleConfig';
import { ALL_SKILLS } from '../../constants/skills';

interface InputAreaProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e?: React.FormEvent) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSkillSelect?: (skillId: string, prompt: string) => void;
  selectedSkillId?: string | null;
  onClearSkill?: () => void;
  styleConfig: StyleConfig;
}

export function InputArea({
  inputValue,
  setInputValue,
  isLoading,
  inputFocused,
  setInputFocused,
  textareaRef,
  fileInputRef,
  onSubmit,
  onFileUpload,
  onSkillSelect,
  selectedSkillId,
  onClearSkill,
  styleConfig,
}: InputAreaProps) {
  const { t, i18n } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUploadClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('fileInputRef.current is null');
    }
  }, [fileInputRef]);

  const toggleLanguage = () => {
    const currentIndex = languages.findIndex(lang => lang.code === i18n.language);
    const nextIndex = (currentIndex + 1) % languages.length;
    i18n.changeLanguage(languages[nextIndex].code);
  };

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];
  const isEnglish = i18n.language === 'en-US';
  const displayFooterText = isEnglish ? (styleConfig.footerTextEn || styleConfig.footerText) : styleConfig.footerText;

  return (
    <div className="border-t border-border/40 bg-gradient-to-t from-background/90 to-background/60 backdrop-blur-xl p-3 md:p-4 pb-4 md:pb-6">
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <div className={`relative rounded-lg transition-all duration-500 ${inputFocused ? 'shadow-2xl shadow-violet-500/20 ring-2 ring-violet-500/30 border-violet-500/40' : 'shadow-xl border-border/50 hover:shadow-2xl hover:shadow-violet-500/10'} border bg-background/80 backdrop-blur-xl flex flex-col`}>
          {/* Selected Skill Badge */}
          {selectedSkillId && (
            <div className="flex items-center gap-2 px-3 pt-3">
              {(() => {
                const skill = ALL_SKILLS.find(s => s.id === selectedSkillId);
                if (!skill) return null;
                const Icon = skill.icon;
                return (
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${skill.bgColor} border border-violet-500/20 animate-fade-in`}>
                    <Icon className={`h-3.5 w-3.5 ${skill.color}`} />
                    <span className="text-xs font-medium text-foreground">
                      {t(`skills.items.${skill.id}.name`)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearSkill?.();
                      }}
                      className="ml-1 p-0.5 rounded-full hover:bg-violet-500/20 transition-colors"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
          
          {/* Glow effect */}
          {inputFocused && (
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 animate-pulse" />
          )}
          <div className="relative flex items-end p-1.5 md:p-2">
            <button
              ref={buttonRef}
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className={`flex items-center gap-2 px-3 h-9 md:h-10 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${showMenu ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30' : 'bg-accent/50 hover:bg-accent text-muted-foreground hover:text-violet-500 dark:bg-accent/30 dark:hover:bg-accent/60'}`}
            >
              <SlidersHorizontal className={`h-4 w-4 ${showMenu ? 'text-white' : ''}`} />
              <span className="text-[13px] font-medium">Skills</span>
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center rounded-lg bg-accent/50 hover:bg-accent transition-all duration-200 text-muted-foreground hover:text-violet-500 hover:scale-105 active:scale-95 cursor-pointer dark:bg-accent/30 dark:hover:bg-accent/60"
            >
              <Upload className="h-4 w-4 md:h-5 md:w-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
              placeholder={isEnglish ? 'Type a message, press Enter to send...' : '输入消息，按 Enter 发送...'}
              className="flex-1 resize-none bg-transparent px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60 min-h-[40px] md:min-h-[44px] max-h-[200px]"
              disabled={isLoading}
              rows={1}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !inputValue.trim()} 
              className="h-9 w-9 md:h-10 md:w-10 rounded-lg bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 hover:from-violet-600 hover:via-purple-600 hover:to-pink-600 disabled:opacity-40 shadow-lg shadow-violet-500/30 transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-xl hover:shadow-violet-500/40"
            >
              <Send className={`h-3.5 w-3.5 md:h-4 md:w-4 transition-transform duration-300 ${inputValue.trim() ? 'translate-x-0.5' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-1.5 md:mt-2 flex items-center justify-center gap-2 md:gap-3 text-[10px] md:text-xs text-muted-foreground">
          <span className="hidden sm:inline">{displayFooterText}</span>
          <span className="hidden sm:inline text-border">|</span>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 md:gap-1.5 hover:text-foreground transition-colors"
          >
            <Globe className="h-3 w-3 md:h-3.5 md:w-3.5" />
            <span>{currentLang.flag} {currentLang.name}</span>
          </button>
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileUpload}
        accept=".pdf,.txt,.md,.markdown,.html,.htm,.doc,.docx"
      />

      {/* Skill Selection Menu */}
      {showMenu && (
        <div 
          ref={menuRef}
          className="absolute bottom-full left-4 md:left-auto mb-2 w-64 bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            boxShadow: `0 20px 50px -12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)`,
          }}
        >
          <div className="p-3 border-b border-border/40">
            <h3 className="text-xs font-semibold text-muted-foreground px-2">{t('common.tools')}</h3>
          </div>
          <div className="p-1.5 pt-1">
            {ALL_SKILLS.filter(s => s.id === 'pptGenerate').map((skill) => {
              const Icon = skill.icon;
              return (
                <button
                  key={skill.id}
                  onClick={() => {
                    onSkillSelect?.(skill.id, t(`skills.prompts.${skill.id}`));
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200 group text-left"
                >
                  <div className={`p-2 rounded-lg ${skill.bgColor} transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className={`h-4 w-4 ${skill.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{t(`skills.items.${skill.id}.name`)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
