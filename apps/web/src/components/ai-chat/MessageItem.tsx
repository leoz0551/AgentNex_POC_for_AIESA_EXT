import { memo } from 'react';
import { Bot, User, Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Play } from 'lucide-react';
import type { Message } from '../../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageItemProps {
  message: Message;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string, feedback: 'like' | 'dislike') => void;
  onShowCourse?: (taskId: string) => void;
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export const MessageItem = memo(function MessageItem({ message, copiedId, onCopy, onRegenerate, onFeedback, onShowCourse }: MessageItemProps) {

  let displayContent = message.content;
  let hasCourseCta = false;
  
  if (message.role === 'assistant') {
    if (displayContent.includes('course://')) {
      hasCourseCta = true;
      displayContent = displayContent.replace(/(?:详细内容，可以参考微课程：|For detailed content, please refer to micro-course:)?\s*\[.*?\]\(course:\/\/.*?\)/gi, '').trim();
    }
  }
  return (
    <div className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-1' : 'mr-1'}`}>
        {message.role === 'assistant' ? (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl blur-md opacity-40" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
              <Bot className="h-5 w-5 text-white" />
            </div>
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 shadow-md">
            <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </div>
        )}
      </div>

      {/* Message Bubble */}
      <div className={`group flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
        <div className={`relative rounded-2xl px-5 py-3.5 shadow-sm transition-all duration-200 ${message.role === 'user' ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-violet-500/20' : 'bg-muted/80 text-foreground backdrop-blur-sm border border-border/50'}`}>
          {message.role === 'user' ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{displayContent}</p>
          ) : (
            <MarkdownRenderer content={displayContent} />
          )}
          <div className={`absolute -bottom-1 ${message.role === 'user' ? 'right-4' : 'left-4'} w-2 h-2 rotate-45 ${message.role === 'user' ? 'bg-purple-600' : 'bg-muted/80 border-l border-b border-border/50'}`} />
        </div>

        {/* Micro-course Recommendation CTA Card */}
        {hasCourseCta && message.courseTaskId && onShowCourse && (
          <div className="mt-3.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="inline-block p-1 rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50/50 dark:from-violet-950/30 dark:to-purple-900/20 border border-violet-100 dark:border-violet-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                <span className="text-xs text-foreground/80 font-semibold">I have generated a Micro-course for you</span>
                <button 
                  onClick={() => onShowCourse(message.courseTaskId!)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-bold shadow-md shadow-violet-500/10 hover:shadow-lg hover:shadow-violet-500/20 hover:scale-[1.02] active:scale-95 transition-all w-fit"
                >
                  <Play className="h-3 w-3 fill-current" />
                  View Micro-course
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Actions */}
        <div className={`flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <span className="text-[11px] text-muted-foreground px-2">{formatTime(message.timestamp)}</span>
          {message.role === 'assistant' && (
            <>
              <button onClick={() => onCopy(message.content, message.id)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                {copiedId === message.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
              <button onClick={onRegenerate} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button onClick={() => onFeedback(message.id, 'like')} className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${message.feedback === 'like' ? 'bg-emerald-500/10' : ''}`}>
                <ThumbsUp className={`h-3.5 w-3.5 ${message.feedback === 'like' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
              </button>
              <button onClick={() => onFeedback(message.id, 'dislike')} className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${message.feedback === 'dislike' ? 'bg-red-500/10' : ''}`}>
                <ThumbsDown className={`h-3.5 w-3.5 ${message.feedback === 'dislike' ? 'text-red-500' : 'text-muted-foreground'}`} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
