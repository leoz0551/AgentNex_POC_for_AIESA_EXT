import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ToolsPanelProps {
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
}

export function ToolsPanel({ webSearchEnabled, onToggleWebSearch }: ToolsPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground font-medium">
        {t('tools.description')}
      </p>
      <div className="space-y-4">
        {/* 网络搜索开关 */}
        <div className="p-5 rounded-lg bg-muted/50 border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-violet-500/20">
                <Search className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="font-medium">{t('tools.webSearch')}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{t('tools.webSearchDesc')}</p>
              </div>
            </div>
            <button
              onClick={onToggleWebSearch}
              role="switch"
              aria-checked={webSearchEnabled}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background ${
                webSearchEnabled ? 'bg-violet-500' : 'bg-muted-foreground/40 dark:bg-muted-foreground/50'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  webSearchEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          {webSearchEnabled && (
            <p className="text-[11px] text-violet-500 mt-3 pl-14">
              ✓ {t('tools.webSearchEnabled')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
