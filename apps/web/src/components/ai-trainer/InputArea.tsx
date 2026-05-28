import { Send, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@workspace/ui/components/button';
import { languages } from '../../i18n';

interface InputAreaProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  inputFocused: boolean;
  setInputFocused: (focused: boolean) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: (e?: React.FormEvent) => void;
}

export function InputArea({
  inputValue,
  setInputValue,
  isLoading,
  inputFocused,
  setInputFocused,
  textareaRef,
  onSubmit,
}: InputAreaProps) {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const currentIndex = languages.findIndex(lang => lang.code === i18n.language);
    const nextIndex = (currentIndex + 1) % languages.length;
    i18n.changeLanguage(languages[nextIndex].code);
  };

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];
  const isEnglish = i18n.language === 'en-US';

  return (
    <div className="bg-white border-t border-slate-200/80 p-3 md:p-4 pb-4 md:pb-6">
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
        <div 
          className={`relative rounded-xl transition-all duration-300 ${
            inputFocused 
              ? 'shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20 border-blue-400' 
              : 'shadow-sm border-slate-200 hover:shadow-md hover:border-slate-300'
          } border bg-slate-50/50`}
        >
          <div className="relative flex items-end p-1.5 md:p-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder={isEnglish ? 'Ask your trainer...' : '向您的培训师提问...'}
              className="flex-1 resize-none bg-transparent px-3 md:px-4 py-2 md:py-2.5 text-sm md:text-[15px] text-slate-800 outline-none placeholder:text-slate-400 min-h-[40px] md:min-h-[44px] max-h-[200px]"
              disabled={isLoading}
              rows={1}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !inputValue.trim()} 
              className="h-9 w-9 md:h-10 md:w-10 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
            >
              <Send className={`h-3.5 w-3.5 md:h-4 md:w-4 text-white transition-transform duration-300 ${inputValue.trim() ? 'translate-x-0.5' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Footer with Language Switcher */}
        <div className="mt-2.5 flex items-center justify-center gap-3 text-[10px] md:text-xs text-slate-400">
          <span>{isEnglish ? 'AI Trainer Simulator' : 'AI 培训师模拟器'}</span>
          <span className="text-slate-200">|</span>
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 hover:text-slate-700 transition-colors font-medium text-slate-500"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{currentLang.flag} {currentLang.name}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
