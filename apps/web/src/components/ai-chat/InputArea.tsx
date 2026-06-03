import { useRef, useEffect } from 'react';
import { Send, Globe, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@workspace/ui/components/button';
import { languages } from '../../i18n';
import type { StyleConfig } from '../../hooks/useStyleConfig';

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
  styleConfig: StyleConfig;
  chatBoardMode: boolean;
  setChatBoardMode: (mode: boolean) => void;
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
  styleConfig,
  chatBoardMode,
}: InputAreaProps) {
  const { i18n } = useTranslation();
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const toggleLanguage = () => {
    const currentIndex = languages.findIndex(lang => lang.code === i18n.language);
    const nextIndex = (currentIndex + 1) % languages.length;
    i18n.changeLanguage(languages[nextIndex].code);
  };

  // Close tools menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        // Menu was removed
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];
  const isEnglish = i18n.language === 'en-US';
  const displayFooterText = isEnglish ? (styleConfig.footerTextEn || styleConfig.footerText) : styleConfig.footerText;

  return (
    <div className="border-t border-border/40 bg-gradient-to-t from-background/90 to-background/60 backdrop-blur-xl p-3 md:p-4 pb-4 md:pb-6">
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <div className={`relative rounded-lg transition-all duration-500 ${inputFocused ? 'shadow-2xl shadow-violet-500/20 ring-2 ring-violet-500/30 border-violet-500/40' : 'shadow-xl border-border/50 hover:shadow-2xl hover:shadow-violet-500/10'} border bg-background/80 backdrop-blur-xl`}>
          {/* GPT style Input Inner Wrapper */}
          <div className="relative flex items-end p-1.5 md:p-2">
            {/* Removed buttons */}

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }}
              placeholder={chatBoardMode ? (isEnglish ? 'Analyzing data logs...' : '正在进行数据分析模式...') : (isEnglish ? 'Type a message...' : '输入消息...')}
              className="flex-1 resize-none bg-transparent px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60 min-h-[40px] md:min-h-[44px] max-h-[200px]"
              disabled={isLoading}
              rows={1}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !inputValue.trim()} 
              className={`h-9 w-9 md:h-10 md:w-10 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg ${chatBoardMode ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20' : 'bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 shadow-violet-500/30'} hover:shadow-xl`}
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
          {chatBoardMode && (
            <>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1 text-emerald-500 font-bold animate-pulse">
                <BarChart3 className="h-3 w-3" />
                CHATBOARD ACTIVE
              </span>
            </>
          )}
        </div>
      </form>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={onFileUpload}
        accept=".pdf,.txt,.md,.markdown,.html,.htm,.doc,.docx"
      />
      
      {/* Upload button for ChatBI with CLEAR flag */}
      <input
        id="chatbi-refresh-upload"
        type="file"
        className="hidden"
        accept=".xlsx,.csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const formData = new FormData();
            formData.append('file', file);
            alert('正在清空旧数据并重新导入，请稍候...');
            try {
              const url = (window.location.hostname === 'localhost' ? 'http://localhost:8000/api/data/upload' : '/api/data/upload') + '?clear=true';
              const res = await fetch(url, { method: 'POST', body: formData });
              const data = await res.json();
              if (res.ok) alert('数据重置并上传成功: ' + (data.message || ''));
              else alert('处理失败: ' + (data.detail || ''));
            } catch (err) {
              alert('请求出错: ' + String(err));
            }
          }
        }}
      />
    </div>
  );
}
