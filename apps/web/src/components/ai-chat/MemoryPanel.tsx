import { Brain, Trash2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Memory } from '../../types';
import { useRelativeTime } from '../../utils/timeFormat';

interface MemoryPanelProps {
  memories: Memory[];
  onDeleteMemory: (memoryId: string) => void;
  error?: string | null;
  loading?: boolean;
}

// 将时间戳或 ISO 字符串转换为 ISO 字符串（供 formatRelativeTime 使用）
function toISOString(dateValue?: string | number): string {
  if (!dateValue) return '';
  
  try {
    if (typeof dateValue === 'number') {
      // 秒级时间戳需要乘以 1000
      return new Date(dateValue * 1000).toISOString();
    } else if (typeof dateValue === 'string') {
      // 尝试解析为数字（可能传入的是字符串形式的时间戳）
      const num = parseInt(dateValue, 10);
      if (!isNaN(num) && dateValue.length === 10) {
        // 10位数字 = 秒级时间戳
        return new Date(num * 1000).toISOString();
      }
      // 已经是 ISO 字符串
      return dateValue;
    }
    return '';
  } catch {
    return '';
  }
}

export function MemoryPanel({ memories, onDeleteMemory, error, loading }: MemoryPanelProps) {
  const { t } = useTranslation();
  const formatRelativeTime = useRelativeTime();

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-foreground">{t('memory.description')}</p>
      
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="text-center text-muted-foreground py-10">
          <Brain className="h-14 w-14 mx-auto mb-3 opacity-20 animate-pulse" />
          <p className="text-sm">{t('common.loading')}</p>
        </div>
      ) : memories.length === 0 ? (
        <div className="text-center text-muted-foreground py-10">
          <Brain className="h-14 w-14 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium text-foreground">{t('memory.empty')}</p>
          <p className="text-xs mt-1.5">{t('memory.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <div key={memory.memory_id} className="p-4 rounded-lg bg-muted/50 border border-border/50 group hover:bg-muted/80 transition-colors">
              <p className="text-sm leading-relaxed text-foreground">{memory.memory}</p>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {memory.topics && memory.topics.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {memory.topics.slice(0, 3).map((topic, i) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-400">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                  {memory.created_at && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                      <Clock className="h-3 w-3" />
                      <span>{formatRelativeTime(toISOString(memory.created_at))}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDeleteMemory(memory.memory_id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 transition-all"
                  title={t('memory.delete') || '删除记忆'}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
