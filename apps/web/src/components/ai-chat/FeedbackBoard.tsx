import { useState, useEffect, useMemo } from 'react';
import { ThumbsUp, ThumbsDown, MessageCircle, ChevronRight, Search, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { chatApi } from '../../api/chat';

export function FeedbackBoard() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [keyword, setKeyword] = useState('');
  const [stats, setStats] = useState({ total: 0, likes: 0, dislikes: 0, comments: 0 });
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [statsData, listData] = await Promise.all([
          chatApi.getFeedbackStats(),
          chatApi.getFeedbackList(statusFilter, keyword)
        ]);
        setStats(statsData);
        setFeedbacks(listData);
      } catch (err) {
        console.error('Error fetching feedback board data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [statusFilter, keyword]);

  // Helper for relative time
  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} days ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} months ago`;
    return `${Math.floor(diffInMonths / 12)} years ago`;
  };

  // 按日期分组
  const groupedFeedbacks = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    const todayStr = new Date().toISOString().split('T')[0];
    
    feedbacks.forEach(item => {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      const label = date === todayStr ? 'Today' : date;
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      return b.localeCompare(a);
    });
  }, [feedbacks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'text-orange-500 hover:text-orange-600';
      case 'Resolved': return 'text-emerald-500 hover:text-emerald-600';
      case 'Not Issue': return 'text-slate-500 hover:text-slate-600';
      default: return 'text-slate-500 hover:text-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <Info className="h-4 w-4" />;
      case 'Resolved': return <CheckCircle2 className="h-4 w-4" />;
      case 'Not Issue': return <Info className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f0f1f8] dark:bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-200/60 bg-white/40 backdrop-blur-xl">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Feedback Board</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
        {/* Stats Cards */}
        <div className="flex items-center gap-8 mb-4">
          <div className="group">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-100 dark:border-violet-800 shadow-sm transition-all hover:scale-105 active:scale-95">
              <span className="text-lg font-bold text-violet-600 dark:text-violet-400">{stats.total}</span>
              <span className="text-xs font-semibold text-slate-600 dark:text-violet-400">Total Feedback</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-bold text-slate-500 uppercase">I like</span>
              <span className="text-lg font-extrabold text-slate-700">{stats.likes}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-bold text-slate-500 uppercase">I don't like</span>
              <span className="text-lg font-extrabold text-slate-700">{stats.dislikes}</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-slate-400" />
              <span className="text-lg font-extrabold text-slate-700">{stats.comments}</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-end">
          <div className="relative w-full sm:w-40">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-background border border-border/60 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-violet-500/20 appearance-none transition-all pr-10 shadow-sm"
            >
              <option value="All">All Status</option>
              <option value="Open">Open</option>
              <option value="Resolved">Resolved</option>
              <option value="Not Issue">Not Issue</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <ChevronRight className="h-4 w-4 rotate-90" />
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Filter keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full bg-background border border-border/60 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
            <p className="text-sm text-muted-foreground font-medium italic">Loading Feedbacks...</p>
          </div>
        ) : feedbacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white/40 border-2 border-dashed border-slate-200 rounded-3xl">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-slate-300" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-400">No feedback records found</p>
              <p className="text-xs text-slate-400 mt-1">Start a conversation and provide some feedback!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-10 animate-in fade-in duration-700">
            {groupedFeedbacks.map(([dateLabel, items]) => (
              <div key={dateLabel} className="space-y-4">
                <h3 className="text-base font-bold text-slate-500 tracking-tight pl-2">
                  {dateLabel}
                </h3>
                <div className="space-y-4">
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      className="group flex items-center bg-[#ebedf5] hover:bg-[#e0e3ee] dark:bg-[#1a1b26] dark:hover:bg-[#222436] rounded-3xl p-5 shadow-sm transition-all duration-300 border border-transparent hover:border-violet-500/10"
                    >
                      {/* Left: Status Box */}
                      <div className="flex flex-col items-center justify-center w-24 h-20 shrink-0 border-r border-slate-300 dark:border-slate-800 pr-5">
                        <div className={`${getStatusColor(item.status)} flex flex-col items-center gap-1.5`}>
                          {getStatusIcon(item.status)}
                          <span className="text-xs font-bold whitespace-nowrap">{item.status}</span>
                        </div>
                      </div>

                      {/* Middle: Content */}
                      <div className="flex-1 px-6 min-w-0">
                        <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 line-clamp-1 mb-2">
                          {item.user_prompt}
                        </h4>
                        <div className="flex items-center gap-2">
                          {item.type === 'like' ? (
                            <ThumbsUp className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                          ) : (
                            <ThumbsDown className="h-4 w-4 text-rose-500 fill-rose-500/20" />
                          )}
                          <span className="text-sm font-medium text-slate-500 truncate capitalize">
                            {item.category || 'None'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Metadata */}
                      <div className="flex items-center gap-6 shrink-0 pl-4">
                        <span className="text-sm text-slate-400 font-medium">{getRelativeTime(item.timestamp)}</span>
                        <div className="flex items-center gap-1.5 text-slate-400 transition-colors group-hover:text-violet-500">
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-sm font-extrabold">{item.comment_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer info */}
        <div className="pt-12 pb-6 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
            By using this chat service, you agree to comply with our policy: 
            <a href="#" className="underline mx-1 text-violet-400 hover:text-violet-600 transition-colors">User Agreement and Privacy Policy</a> 
            | Language: <span className="text-slate-500 font-bold">English</span>
          </p>
        </div>
      </div>
    </div>
  );
}
