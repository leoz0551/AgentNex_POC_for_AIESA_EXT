import { Bot } from 'lucide-react';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  copiedId: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onCopy: (text: string, id: string) => void;
  onRegenerate: () => void;
  onFeedback: (messageId: string, feedback: 'like' | 'dislike') => void;
}

export function MessageList({
  messages,
  isLoading,
  copiedId,
  messagesEndRef,
  onCopy,
  onRegenerate,
  onFeedback,
}: MessageListProps) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          copiedId={copiedId}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
        />
      ))}

      {/* Loading Animation */}
      {isLoading && !messages.some(m => m.role === 'assistant' && m.id.startsWith('temp-ai')) && (
        <div className="flex gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl blur-md opacity-40 animate-pulse" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <Bot className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="bg-muted/80 backdrop-blur-sm border border-border/50 rounded-2xl px-5 py-4">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
