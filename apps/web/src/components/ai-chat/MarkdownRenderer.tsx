import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

// 按需引入 highlight.js 语言包（减少约 300KB）
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';

// 注册语言
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);

import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// 代码块组件
function CodeBlock({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeString]);

  // 检测是否为长代码块
  const lineCount = codeString.split('\n').length;
  const isLongCode = lineCount > 15;
  const [isCollapsed, setIsCollapsed] = useState(isLongCode);

  // 行号
  const lines = codeString.split('\n');
  const showLineNumbers = lineCount > 3;

  if (!className) {
    // 内联代码
    return (
      <code
        className="px-1.5 py-0.5 rounded-md bg-muted/80 font-mono text-[0.875em] text-pink-600 dark:text-pink-400 border border-border/50"
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-border/50 bg-[#0d1117] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border/30">
        <div className="flex items-center gap-2">
          {isLongCode && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27ca40]" />
            </div>
            {language && (
              <span className="text-xs text-muted-foreground font-mono ml-2">
                {language}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-200"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div
        className={`overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent ${
          isCollapsed ? 'max-h-[200px]' : ''
        }`}
      >
        {showLineNumbers ? (
          <div className="flex">
            {/* Line Numbers */}
            <div className="flex-shrink-0 py-4 pr-2 pl-4 text-right select-none border-r border-border/20 bg-[#0d1117]">
              {lines.map((_, i) => (
                <div
                  key={i}
                  className="text-xs leading-6 text-muted-foreground/40 font-mono"
                >
                  {i + 1}
                </div>
              ))}
            </div>
            {/* Code */}
            <pre className="flex-1 p-4 m-0 overflow-x-auto">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          </div>
        ) : (
          <pre className="p-4 overflow-x-auto">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        )}
      </div>

      {/* Collapse Overlay */}
      {isCollapsed && isLongCode && (
        <div
          className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none"
          onClick={() => setIsCollapsed(false)}
        />
      )}
    </div>
  );
}

// 可折叠的思考过程组件
function ThinkingBlock({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="my-3 rounded-xl border border-border/50 overflow-hidden group"
      open={isOpen}
    >
      <summary
        className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
        <span className="text-sm font-medium text-muted-foreground">
          思考过程
        </span>
      </summary>
      <div className="px-4 py-3 bg-muted/30 border-t border-border/30">
        <div className="text-sm text-muted-foreground italic whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </details>
  );
}

// 解析内容，分离 thinking 块
function parseContent(content: string): Array<{ type: 'thinking' | 'markdown'; content: string }> {
  const parts: Array<{ type: 'thinking' | 'markdown'; content: string }> = [];
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let lastIndex = 0;
  let match;

  while ((match = thinkRegex.exec(content)) !== null) {
    // 添加 thinking 之前的普通内容
    if (match.index > lastIndex) {
      const markdownContent = content.slice(lastIndex, match.index).trim();
      if (markdownContent) {
        parts.push({ type: 'markdown', content: markdownContent });
      }
    }
    // 添加 thinking 块
    parts.push({ type: 'thinking', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  // 添加最后一部分普通内容
  if (lastIndex < content.length) {
    const markdownContent = content.slice(lastIndex).trim();
    if (markdownContent) {
      parts.push({ type: 'markdown', content: markdownContent });
    }
  }

  // 如果没有找到任何内容，返回原始内容
  if (parts.length === 0) {
    return [{ type: 'markdown', content }];
  }

  return parts;
}

// Markdown 渲染器
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const parts = useMemo(() => parseContent(content), [content]);

  return (
    <div className={`markdown-body ${className || ''}`}>
      {parts.map((part, index) => {
        if (part.type === 'thinking') {
          return <ThinkingBlock key={index} content={part.content} />;
        }

        return (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              // 代码块
              code: CodeBlock,
              // 段落
              p: ({ children }) => (
                <p className="mb-4 last:mb-0 leading-7">{children}</p>
              ),
              // 标题
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-border/50">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-bold mt-5 mb-3 pb-1 border-b border-border/30">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>
              ),
              // 列表
              ul: ({ children }) => (
                <ul className="my-3 ml-4 list-disc space-y-1.5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 ml-4 list-decimal space-y-1.5">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="leading-7 pl-1">{children}</li>
              ),
              // 引用
              blockquote: ({ children }) => (
                <blockquote className="my-4 pl-4 border-l-4 border-violet-500/50 bg-muted/30 rounded-r-lg py-2 pr-4">
                  {children}
                </blockquote>
              ),
              // 表格
              table: ({ children }) => (
                <div className="my-4 overflow-x-auto rounded-xl border border-border/50">
                  <table className="min-w-full divide-y divide-border/50">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-muted/50">{children}</thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-border/30">{children}</tbody>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-sm">{children}</td>
              ),
              // 链接
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-600 dark:text-violet-400 hover:underline underline-offset-2"
                >
                  {children}
                </a>
              ),
              // 水平线
              hr: () => <hr className="my-6 border-border/50" />,
              // 图片
              img: ({ src, alt }) => (
                <img
                  src={src}
                  alt={alt}
                  className="my-4 rounded-xl border border-border/50 max-w-full h-auto shadow-lg"
                />
              ),
            }}
          >
            {part.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
