import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, X, ChevronLeft, Bot, RefreshCw, Play, CheckCircle2, User } from 'lucide-react';
import { InputArea } from './InputArea';
import { MarkdownRenderer } from '../ai-chat/MarkdownRenderer';
import { chatApi } from '../../api/chat';

interface TrainerMessage {
  id: string;
  role: 'user' | 'assistant';
  type?: 'welcome' | 'reply';
  userQuery?: string;
  content: string; 
  timestamp: string;
  courseTaskId?: string;
}

export function AITrainer() {
  const { t, i18n } = useTranslation();
  
  const [messages, setMessages] = useState<TrainerMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      type: 'welcome',
      content: '', // Dynamically localized
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showCourse, setShowCourse] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [courseData, setCourseData] = useState<any>(null);
  const [isCourseLoading, setIsCourseLoading] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const pollCourseTask = async (taskId: string) => {
    setIsCourseLoading(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      try {
        const res = await chatApi.getCourseTask(taskId);
        if (res.status === 'completed') {
          clearInterval(interval);
          try {
            const parsed = JSON.parse(res.result);
            setCourseData(parsed);
          } catch (e) {
            console.error("Failed to parse course result:", e);
          }
          setIsCourseLoading(false);
        } else if (res.status === 'failed') {
          clearInterval(interval);
          setIsCourseLoading(false);
        }
        attempts++;
        if (attempts > 30) {
          clearInterval(interval);
          setIsCourseLoading(false);
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    
    const userMsg: TrainerMessage = { 
      id: `user-${Date.now()}`, 
      role: 'user', 
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    
    const aiMsgId = `ai-${Date.now()}`;
    const aiMsg: TrainerMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '', // Will be streamed
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    setIsLoading(true);

    // Build message history for the backend RAG agent
    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => {
        let content = m.content;
        if (m.role === 'assistant') {
          if (m.type === 'welcome') {
            content = t('aiTrainer.welcome');
          } else if (m.type === 'reply' && m.userQuery) {
            content = t('aiTrainer.agentReplyPrefix', { query: m.userQuery });
          }
        }
        return {
          content,
          role: m.role
        };
      });

    let accumulatedContent = '';

    // Invoke the real decoupled RAG Agent on the backend
    chatApi.trainerChatStream(
      [...history, { content: userMessage, role: 'user' }],
      sessionId,
      (chunk) => {
        accumulatedContent += chunk;
        setMessages(prev => prev.map(m => 
          m.id === aiMsgId ? { ...m, content: accumulatedContent } : m
        ));
      },
      (data) => {
        setSessionId(data.session_id);
        setIsLoading(false);
        if (data.course_task_id) {
          setMessages(prev => prev.map(m => 
            m.id === aiMsgId ? { ...m, courseTaskId: data.course_task_id } : m
          ));
        }
      },
      (error) => {
        console.error('AI Trainer Agent Stream error:', error);
        setMessages(prev => prev.map(m => 
          m.id === aiMsgId ? { ...m, content: t('chat.errorMessage') } : m
        ));
        setIsLoading(false);
      }
    );
  };

  const handleShowCourse = (taskId?: string) => {
    setShowCourse(true);
    if (taskId && (!courseData || isCourseLoading)) {
      pollCourseTask(taskId);
    }
  };

  const isEnglish = i18n.language === 'en-US';

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 overflow-hidden font-sans">
      
      {/* Left Chat Area */}
      <div className={`flex flex-col h-full bg-white transition-all duration-300 ${showCourse ? 'w-1/2 border-r border-slate-200/80 shadow-sm' : 'w-full max-w-5xl mx-auto'}`}>
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-white shrink-0 shadow-sm shadow-slate-100/40">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.location.href = '/'} 
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
              title={t('aiTrainer.backToHome')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="h-8.5 w-8.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/10">
                <GraduationCap className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800 tracking-tight leading-tight">{t('aiTrainer.title')}</h1>
                <p className="text-[10px] md:text-[11px] text-slate-400 font-medium">{t('aiTrainer.subtitle')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar bg-slate-50/50">
          {messages.map((msg) => {
            // Get content dynamically based on current language
            let displayContent = msg.content;
            let hasCourseCta = false;
            
            if (msg.role === 'assistant') {
              if (msg.type === 'welcome') {
                displayContent = t('aiTrainer.welcome');
              } else if (msg.type === 'reply' && msg.userQuery) {
                // Legacy mockup fallback
                displayContent = t('aiTrainer.agentReplyPrefix', { query: msg.userQuery });
              }
              
              // Skip rendering empty assistant bubbles to avoid showing two boxes
              if (displayContent.trim() === '') {
                return null;
              }
              
              // If it's a real LLM streaming response and contains a micro-course redirect, strip it and show the custom UI button
              if (displayContent.includes('course://')) {
                hasCourseCta = true;
                // Regex to strip the markdown link and the leading text like "详细内容，可以参考微课程：" or "For detailed content, please refer to micro-course:"
                displayContent = displayContent.replace(/(?:详细内容，可以参考微课程：|For detailed content, please refer to micro-course:)?\s*\[.*?\]\(course:\/\/.*?\)/gi, '').trim();
              }
            }

            return (
              <div key={msg.id} className="relative group">
                {/* Custom Decoupled Message Bubble Rendering */}
                <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {msg.role === 'assistant' ? (
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur-md opacity-30 animate-pulse" />
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 shadow-sm">
                        <User className="h-5 w-5 text-slate-700" />
                      </div>
                    )}
                  </div>

                  {/* Message Bubble Container */}
                  <div className={`group flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div className={`relative rounded-2xl px-5 py-3.5 shadow-sm transition-all duration-200 ${msg.role === 'user' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-600/10' : 'bg-white text-slate-800 border border-slate-200/80 shadow-sm'}`}>
                      {msg.role === 'user' ? (
                        <p className="text-[14px] md:text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{displayContent}</p>
                      ) : (
                        <MarkdownRenderer content={displayContent} className="text-[14px] md:text-[15px] leading-relaxed prose prose-slate max-w-none text-slate-800" />
                      )}
                      
                      {/* Triangle Pointer */}
                      <div className={`absolute -bottom-1 ${msg.role === 'user' ? 'right-4 bg-indigo-600' : 'left-4 bg-white border-l border-b border-slate-200/80'} w-2 h-2 rotate-45`} />
                    </div>

                    {/* Time Stamp */}
                    <div className="flex items-center mt-1.5 px-2">
                      <span className="text-[10px] text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString(isEnglish ? 'en-US' : 'zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Micro-course Recommendation CTA Card */}
                {hasCourseCta && (
                  <div className="mt-3.5 ml-13 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="inline-block p-1 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                        <span className="text-xs text-slate-600 font-semibold">{t('aiTrainer.courseCtaPrefix')}</span>
                        <button 
                          onClick={() => handleShowCourse(msg.courseTaskId)}
                          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-all w-fit"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          {t('aiTrainer.courseCtaButton')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Loader */}
          {isLoading && !messages.some(m => m.role === 'assistant' && m.content.length > 0 && m.id !== 'welcome') && (
            <div className="flex gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl blur-md opacity-30 animate-pulse" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl px-5 py-4">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Local Decoupled Input Area */}
        <div className="shrink-0 bg-white shadow-sm border-t border-slate-100">
          <InputArea
            inputValue={inputValue}
            setInputValue={setInputValue}
            isLoading={isLoading}
            inputFocused={inputFocused}
            setInputFocused={setInputFocused}
            onSubmit={handleSubmit}
            textareaRef={textareaRef}
          />
        </div>
      </div>

      {/* Right Course Area */}
      {showCourse && (
        <div className="w-1/2 h-full flex flex-col bg-white border-l border-slate-200/80 animate-in slide-in-from-right-8 duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60 bg-white shrink-0 shadow-sm shadow-slate-100/40">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <GraduationCap className="h-5.5 w-5.5" />
              </div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">
                {courseData?.course_title || t('aiTrainer.courseTitle')}
              </h2>
            </div>
            <button 
              onClick={() => setShowCourse(false)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar bg-slate-50/20">
            {isCourseLoading ? (
               <div className="flex flex-col items-center justify-center h-full space-y-4">
                 <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                 <p className="text-slate-500 font-medium">Generating micro-course content...</p>
               </div>
            ) : courseData ? (
               <div className="flex flex-col md:flex-row gap-8">
                 {/* Main Content (Left) */}
                 <div className="flex-1 prose prose-slate max-w-none text-slate-700">
                   {courseData.learning_objectives && courseData.learning_objectives.length > 0 && (
                     <div className="mb-8">
                       <h3 className="text-xl font-bold text-slate-800 mb-4">Learning Objectives</h3>
                       <ul className="list-disc pl-5 space-y-2">
                         {courseData.learning_objectives.map((obj: string, idx: number) => (
                           <li key={idx} className="text-slate-700">{obj}</li>
                         ))}
                       </ul>
                     </div>
                   )}
                   {courseData.sections && courseData.sections.map((section: any, idx: number) => (
                     <div key={idx} className="mb-8" id={`section-${idx}`}>
                       <h3 className="text-xl font-bold text-slate-800 mb-4">{section.section_title}</h3>
                       <div className="space-y-4">
                         {section.content.map((paragraph: string, pIdx: number) => (
                           <p key={pIdx} className="text-slate-700 leading-relaxed">{paragraph}</p>
                         ))}
                       </div>
                     </div>
                   ))}
                 </div>
                 {/* Table of Contents (Right) */}
                 <div className="w-48 shrink-0 hidden md:block border-l border-slate-200 pl-6 space-y-6 self-start sticky top-0">
                   {courseData.time_estimate && (
                     <div>
                       <h4 className="text-sm font-bold text-slate-800 mb-2">Time Estimate</h4>
                       <p className="text-xs text-slate-500 flex items-center gap-1">
                         <span className="w-3 h-3 rounded-full border border-slate-400 block shrink-0" />
                         {courseData.time_estimate}
                       </p>
                     </div>
                   )}
                   <div>
                     <h4 className="text-sm font-bold text-slate-800 mb-2">Topics</h4>
                     <div className="w-1 h-4 bg-blue-500 absolute -ml-6 mt-1 rounded-r-md"></div>
                     <ul className="space-y-3">
                       <li className="text-xs text-blue-600 font-medium cursor-pointer">Learning Objectives</li>
                       {courseData.sections && courseData.sections.map((section: any, idx: number) => (
                         <li key={idx} className="text-xs text-slate-600 hover:text-blue-600 cursor-pointer transition-colors">
                           {section.section_title}
                         </li>
                       ))}
                     </ul>
                   </div>
                 </div>
               </div>
            ) : (
               <div className="prose prose-slate max-w-none text-slate-700">
                 <MarkdownRenderer content={t('aiTrainer.courseContent')} />
               </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-5 border-t border-slate-200/60 bg-white flex justify-between items-center shrink-0">
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCourse(false)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 font-bold transition-all shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t('aiTrainer.finish')}
              </button>
              <button 
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold transition-all shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                {t('aiTrainer.regenerate')}
              </button>
            </div>
            
            <button 
              className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
            >
              <Bot className="h-4 w-4" />
              {t('aiTrainer.practice')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
