import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { languages } from '../../i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const currentIndex = languages.findIndex(lang => lang.code === i18n.language);
    const nextIndex = (currentIndex + 1) % languages.length;
    i18n.changeLanguage(languages[nextIndex].code);
  };

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <button
      onClick={toggleLanguage}
      className="p-2 rounded-lg hover:bg-accent transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5"
      title={`当前: ${currentLang.name}`}
    >
      <Globe className="h-4 w-4" />
      <span className="text-xs font-medium">{currentLang.flag}</span>
    </button>
  );
}
