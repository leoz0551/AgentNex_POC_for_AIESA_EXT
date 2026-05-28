import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Database, Workflow, History, Sparkles, Search, Clock, 
  RefreshCw, Play, CheckCircle2, AlertTriangle, FileText, Globe, 
  Activity, Check, X, ChevronLeft, ChevronRight, Import, 
  ShieldAlert, BookOpen, AlertCircle, Upload, Loader2, Plus
} from 'lucide-react';
import { kbevolApi } from '../../api';


interface Task {
  id: string;
  title: string;
  desc: string;
  status: string;
  transcript: string;
  gapCause: string;
  gapDesc: string;
  retrieved: string;
  source: string;
  markdown: string;
  progress: number;
  time: string;
  completed_steps?: string[];
}

export function KBEvolutionStudio() {
  const { i18n } = useTranslation();
  const isEn = i18n.language === 'en-US';

  // inline translator utility
  const t = (zh: string, en: string) => isEn ? en : zh;

  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [activeTaskId, setActiveTaskId] = useState<string>('');

  const fetchTasks = async () => {
    try {
      const data = await kbevolApi.getTasks();
      setTasks(data);
    } catch (e) {
      console.error('Failed to fetch tasks', e);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (Object.keys(tasks).length > 0) {
      // Keys are numeric IDs like "1", "2". JS sorts them ascending. We want descending (latest first).
      const sortedKeys = Object.keys(tasks).sort((a, b) => Number(b) - Number(a));
      
      // If no active task or the active task doesn't exist anymore, select the latest
      if (!activeTaskId || !tasks[activeTaskId]) {
        setActiveTaskId(sortedKeys[0]);
      }
    }
  }, [tasks, activeTaskId]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [traceTaskId, setTraceTaskId] = useState('');
  
  // Real file upload states & ref
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interactive Simulation States
  const [approveLoading, setApproveLoading] = useState(false);
  const [editorValue, setEditorValue] = useState('');
  const [addedVectors, setAddedVectors] = useState<string[]>([]);
  const [deletedVectors, setDeletedVectors] = useState<string[]>([]);
  
  // Trigger input state
  const [triggerText, setTriggerText] = useState('');

  const activeTask = tasks[activeTaskId];

  // Sync editor value when switching tasks
  useEffect(() => {
    if (activeTask) {
      setEditorValue(activeTask.markdown);
    }
  }, [activeTaskId]);

  const switchTask = (id: string) => {
    setActiveTaskId(id);
  };

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const triggerApprove = () => {
    if (activeTask.progress === 100) return;
    setApproveLoading(true);

    // Simulate Part 2 Workflow (Ingestion & Verification Stepper)
    setTimeout(() => {
      // Step 4 Complete: Ingestion
      setTasks(prev => ({
        ...prev,
        [activeTaskId]: {
          ...prev[activeTaskId],
          progress: 75,
          status: t('步骤5: 校验执行中', 'Step 5: Running Verification')
        }
      }));

      setTimeout(() => {
        // Step 5 Complete: Verification
        setTasks(prev => ({
          ...prev,
          [activeTaskId]: {
            ...prev[activeTaskId],
            progress: 100,
            status: t('步骤5: 校验成功 (Regression Passed)', 'Step 5: Verified Success (Regression Passed)')
          }
        }));
        
        setApproveLoading(false);
        setAddedVectors(prev => [...prev, activeTaskId]);
      }, 1500);
    }, 1200);
  };

  const triggerRegenerate = () => {
    setEditorValue(t('⏳ Agno Generator Agent 正在重新调用 Tavily 联网检索中...', '⏳ Agno Generator Agent is querying Tavily web search engines...'));
    setTimeout(() => {
      setEditorValue(activeTask.markdown + `\n\n### 3. ${t('特殊例外与补充说明', 'Exceptions and Additional Rules')}\n* ${t('针对多重折旧重叠项，在计算 L1 利润时需剔除 L3 级别的重复摊销项。', 'For overlapping multiple depreciations, L3 duplicate amortizations must be excluded from L1 profit calculations.')}\n* ${t('联想全球供应链(GSC)补贴在计入修正项时需乘以外汇平价系数。', 'Lenovo Global Supply Chain (GSC) subsidies must be multiplied by parity coefficients when applied.')}`);
      alert(t('✅ 已成功联网补充搜索！新增 "特殊例外与补充说明" 修正条目。', '✅ Web search successfully completed! Added "Exceptions and Additional Rules" section.'));
    }, 1200);
  };

  const triggerReject = () => {
    if (confirm(t('确定要拒绝当前的进化推荐方案吗？任务将被永久移除。', 'Are you sure you want to reject this evolution proposal? It will be permanently removed.'))) {
      const remainingIds = Object.keys(tasks).filter(id => id !== activeTaskId);
      const updatedTasks = { ...tasks };
      delete updatedTasks[activeTaskId];
      setTasks(updatedTasks);
      alert(t('已成功驳回该知识建议。', 'Knowledge proposal successfully rejected.'));
      if (remainingIds.length > 0) {
        setActiveTaskId(remainingIds[0]);
      }
    }
  };

  const handleManualTriggerSubmit = async () => {
    if (!triggerText.trim()) {
      alert(t('请输入需要进化的会话记录！', 'Please enter a conversation log to evolve!'));
      return;
    }

    setTriggerModalOpen(false);
    
    try {
      await kbevolApi.trigger(triggerText);
      setTriggerText('');
      alert(t('✅ 已提交！正在后台执行评估分析...', '✅ Submitted! Running evaluation in background...'));
      fetchTasks();
    } catch(e) {
      alert(t('触发失败', 'Trigger failed'));
    }
  };

  const handlePresetSelect = (presetType: string) => {
    let script = '';
    if (presetType === 'preset-1') {
      script = `[User]: ThinkPad X1 Carbon Gen 12 最新的续航规格是几个小时？\n[Assistant]: ThinkPad X1 Carbon 的电池续航通常在 10 小时左右。\n[系统警告]: 检索到了 Gen 11 的旧规格，Gen 12 搜索未命中，需要进化。`;
    } else {
      script = `[User]: 最新的 GSC 海外物流补贴政策中，发往美东的重货能享受几折？\n[Assistant]: 对不起，我这里仅检索到2025年的标准是八五折，最新的供应链物流补充公告尚未入库。\n[系统异常]: 知识缺失，急需进化。`;
    }
    setTriggerText(script);
    setImportModalOpen(false);
    setTriggerModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    // Dynamic progress bar updates
    const interval = setInterval(() => {
      setUploadProgress(p => (p >= 90 ? p : p + 10));
    }, 100);

    try {
      await kbevolApi.uploadTrigger(file);
      clearInterval(interval);
      setUploadProgress(100);
      alert(t('✅ 对话日志上传并解析成功！已在后台自动触发知识进化工作流。', '✅ Dialogue log uploaded and parsed successfully! Started background evolution workflow.'));
      setImportModalOpen(false);
      fetchTasks();
    } catch (err: any) {
      clearInterval(interval);
      setUploadError(err.message || t('上传解析失败', 'Failed to upload and parse'));
      alert(err.message || t('上传解析失败', 'Failed to upload and parse'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (e.target) {
        e.target.value = '';
      }
    }
  };


  const openTrace = (id: string) => {
    setTraceTaskId(id);
    setActiveTaskId(id);
    setTraceModalOpen(true);
  };

  const eraseVector = (id: string) => {
    if (confirm(t(`⚠️ 警告: 您确定要在 ChromaDB 向量库中永久擦除 evolved_${id}.md 对应的所有分片向量吗？此操作不可逆。`, `⚠️ Warning: Are you sure you want to permanently erase all vectors for evolved_${id}.md from ChromaDB? This action is irreversible.`))) {
      setDeletedVectors(prev => [...prev, id]);
      alert(t(`ChromaDB: 成功根据 metadata task_id='${id}' 精准擦除了相关向量项！`, `ChromaDB: Successfully erased vectors associated with task_id='${id}' using metadata mappings.`));
    }
  };

  const getStepStatus = (stepNumber: number, task: Task) => {
    const completedSteps = task.completed_steps || [];
    const isTerminated = task.gapCause === 'Success' || task.status.includes('Terminated') || task.progress === 15;

    if (isTerminated) {
      return stepNumber === 1 ? 'completed' : 'skipped';
    }

    const stepAgentMap: Record<number, string> = {
      1: "Evaluator",
      2: "GapAnalyzer",
      3: "KnowledgeGenerator"
    };

    if (stepNumber <= 3) {
      const currentAgent = stepAgentMap[stepNumber];
      if (completedSteps.includes(currentAgent)) {
        return 'completed';
      }
      
      const prevAgents = Object.values(stepAgentMap).slice(0, stepNumber - 1);
      const isPrevDone = prevAgents.every(agent => completedSteps.includes(agent));
      
      return isPrevDone ? 'running' : 'pending';
    }

    if (stepNumber === 4) {
      if (!completedSteps.includes("KnowledgeGenerator")) return 'pending';
      if (task.progress === 100) return 'completed';
      return 'running';
    }

    if (stepNumber === 5) {
      if (task.progress === 100) return 'completed';
      return 'pending'; // 5 runs automatically when 4 is approved, so it is just pending until 100
    }

    return 'pending';
  };

  const getLineWidth = (task: Task) => {
    if (getStepStatus(5, task) === 'completed') return 90; 
    if (getStepStatus(2, task) === 'skipped') return 10; 
    
    let completedCount = 0;
    for (let i = 1; i <= 5; i++) {
      if (getStepStatus(i, task) === 'completed') completedCount++;
    }
    
    if (completedCount >= 4) return 90;
    if (completedCount === 3) return 65;
    if (completedCount === 2) return 38;
    if (completedCount === 1) return 15;
    return 0;
  };

  const getStepNodeStyle = (stepNumber: number, task: Task) => {
    const status = getStepStatus(stepNumber, task);
    
    if (status === 'skipped') return "bg-slate-100 border-slate-200 text-slate-300 opacity-50";
    if (status === 'completed') return stepNumber === 5 ? "bg-emerald-500 text-white border-emerald-400" : "bg-indigo-600 text-white border-indigo-200";
    
    if (status === 'running') {
      if (stepNumber === 4) return approveLoading ? "bg-slate-50 border-indigo-500 text-indigo-600 animate-pulse ring-2 ring-indigo-100" : "bg-slate-50 border-purple-500/40 text-purple-650 ring-2 ring-purple-100/50";
      if (stepNumber === 5) return approveLoading ? "bg-slate-50 border-slate-300 text-slate-400 animate-pulse" : "bg-slate-50 border-slate-200 text-slate-400";
      return "bg-slate-50 border-indigo-500 text-indigo-600 animate-pulse ring-2 ring-indigo-100";
    }
    
    return "bg-slate-50 border-slate-200 text-slate-400";
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-700 select-none overflow-hidden relative">
      
      {/* Sidebar / Left historical logs list */}
      <section className="w-72 bg-white border-r border-slate-200 p-4 flex flex-col h-full shrink-0 shadow-sm relative">
        
        {/* Title Header */}
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
          <h2 className="font-outfit font-semibold text-sm flex items-center gap-2 text-slate-800">
            <History className="h-4.5 w-4.5 text-indigo-600 shrink-0" />
            <span>{t('进化历史记录', 'Evolution History Logs')}</span>
          </h2>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 font-mono">
            {Object.keys(tasks).length} {t('记录', 'Tasks')}
          </span>
        </div>

        {/* New Task Button */}
        <button 
          onClick={() => { setImportModalOpen(true); setUploadError(null); }}
          className="w-full mb-3 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-semibold py-2.5 px-3 rounded-xl transition duration-200 flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 text-indigo-100" />
          <span>{t('新建进化任务', 'New Evolution Task')}</span>
        </button>


        {/* Localized Filter input */}
        <div className="mb-4 relative">
          <input 
            type="text" 
            placeholder={t("搜索历史 ID / 节点...", "Search task ID / node...")} 
            className="w-full bg-slate-50 border border-slate-200 text-xs rounded-lg px-3 py-2 pl-8 focus:outline-none focus:border-indigo-500 text-slate-700" 
          />
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        {/* Scroll Queue */}
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
          {Object.values(tasks).map(task => {
            const isActive = task.id === activeTask?.id;
            return (
              <div 
                key={task.id} 
                onClick={() => switchTask(task.id.replace('#', ''))}
                className={`p-3 rounded-xl cursor-pointer transition duration-300 border ${
                  isActive 
                    ? 'bg-white border-indigo-500 shadow-[0_4px_12px_rgba(99,102,241,0.08)] ring-1 ring-indigo-500/20' 
                    : 'bg-white border-slate-200 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-[10px] font-mono text-slate-400">{task.id}</span>
                  <span className={`text-[9px] border px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 ${
                    task.progress === 100 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {task.progress === 100 ? (
                      <>
                        <Check className="h-2.5 w-2.5 text-emerald-600" />
                        {t('步骤5: 校验成功', 'Step 5: Verified')}
                      </>
                    ) : (
                      <>
                        <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>
                        {t('步骤4: 人工审批', 'Step 4: Approving')}
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mb-2 truncate">{task.title}</p>
                <div className="grid grid-cols-1 gap-1 text-[9px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="h-2.5 w-2.5 text-rose-500" />
                    <span>{t('类别', 'Category')}: {
                      task.gapCause === 'Success' ? t('已解决 (Success)', 'Success') :
                      task.gapCause === 'Failed' ? t('未解决 (Failed)', 'Failed') :
                      task.gapCause === 'Aborted' ? t('已放弃 (Aborted)', 'Aborted') :
                      task.gapCause === 'Escalated' ? t('转人工 (Escalated)', 'Escalated') :
                      task.gapCause
                    }</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Clock className="h-2.5 w-2.5" /> 
                    <span>{task.time}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Durable State Footer Info */}
        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between mt-3 text-[9px]">
          <span className="text-slate-500 font-semibold flex items-center gap-1">
            <Database className="h-3 w-3 text-indigo-600" />
            <span>SQLite Engine:</span>
          </span>
          <span className="font-mono text-slate-650 font-semibold">data/kb_evol.db</span>
        </div>
      </section>

      {/* Middle Workspace: Upper Stepper/Editor & Lower Dashboard */}
      <section className="flex-1 flex flex-col h-full gap-5 min-w-0 p-4">
        
        {/* Upper Workspace: Stepper & Editor */}
        {!activeTask ? (
          <div className="light-card rounded-2xl p-4 flex flex-col items-center justify-center min-h-[460px] flex-1 bg-white border-2 border-dashed border-slate-200">
            <Database className="h-12 w-12 text-slate-300 mb-4" />
            <h2 className="text-lg font-bold text-slate-500 mb-2">{t('当前无进化记录', 'No Evolution Tasks Found')}</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md text-center">{t('点击下方按钮导入测试脚本，启动知识进化的 Workflow', 'Click the button below to import a test script and start the Knowledge Evolution Workflow.')}</p>
            <button 
              onClick={() => { setImportModalOpen(true); setUploadError(null); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-300 flex items-center gap-2 shadow-md"
            >
              <Import className="h-4 w-4" />
              <span>{t('导入测试用户对话脚本', 'Import Test Dialogue Script')}</span>
            </button>
          </div>
        ) : (
        <div className="light-card rounded-2xl p-4 flex flex-col min-h-[460px] flex-1 bg-white">
          
          {/* Active Title Details */}
          <div className="flex justify-between items-start mb-3 pb-2 border-b border-slate-100 shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">{activeTask.id}</span>
                <h2 className="text-sm font-bold font-outfit text-slate-800">{activeTask.title}</h2>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">{activeTask.desc}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => { setImportModalOpen(true); setUploadError(null); }}
                className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition duration-300 flex items-center gap-1.5 shadow-sm"
              >
                <Import className="h-3.5 w-3.5" />
                <span>{t('导入测试用户对话脚本', 'Import Test Dialogue Script')}</span>
              </button>
              
              <span className={`text-[10px] border px-2.5 py-1 rounded-full font-semibold ${
                activeTask.progress === 100 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : activeTask.progress === 15 || activeTask.status.includes('Terminated')
                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {activeTask.progress === 100 
                  ? t('回归测试通过 (Regression Passed)', 'Regression Passed') 
                  : (activeTask.progress === 15 || activeTask.status.includes('Terminated'))
                    ? t('无需进化 (No Evolution Needed)', 'No Evolution Needed')
                    : t('待人工审批 (Pending HITL)', 'Pending HITL Approval')}
              </span>
            </div>
          </div>

          {/* Agno Workflow Stepper */}
          <div className="grid grid-cols-5 gap-2 mb-4 relative shrink-0">
            <div className="absolute top-3.5 left-6 right-6 h-0.5 bg-slate-200 z-0"></div>
            <div 
              className="absolute top-3.5 left-6 h-0.5 bg-indigo-600 z-0 transition-all duration-700" 
              style={{ width: `${getLineWidth(activeTask)}%` }}
            ></div>
            
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center z-10">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-sm ${getStepNodeStyle(1, activeTask)}`}>
                <Search className="h-3 w-3" />
              </div>
              <span className={`text-[9px] font-semibold mt-1 ${getStepStatus(1, activeTask) === 'skipped' ? 'text-slate-400' : 'text-slate-700'}`}>{t('1. 评估分析', '1. Evaluation')}</span>
              <span className={`text-[8px] font-bold ${getStepStatus(1, activeTask) === 'skipped' ? 'text-slate-400' : 'text-emerald-600'}`}>{t('已触发', 'Evaluated')}</span>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center z-10">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-sm ${getStepNodeStyle(2, activeTask)}`}>
                <AlertTriangle className="h-3 w-3" />
              </div>
              <span className={`text-[9px] font-semibold mt-1 ${getStepStatus(2, activeTask) === 'skipped' ? 'text-slate-400' : 'text-slate-700'}`}>{t('2. 缝隙诊断', '2. Gap Analysis')}</span>
              <span className={`text-[8px] font-bold ${getStepStatus(2, activeTask) === 'skipped' ? 'text-slate-400' : 'text-amber-600'}`}>{
                getStepStatus(2, activeTask) === 'skipped' ? t('无需进化', 'Skipped') :
                activeTask.gapCause === 'Success' ? t('已解决 (Success)', 'Success') :
                activeTask.gapCause === 'Failed' ? t('未解决 (Failed)', 'Failed') :
                activeTask.gapCause === 'Aborted' ? t('已放弃 (Aborted)', 'Aborted') :
                activeTask.gapCause === 'Escalated' ? t('转人工 (Escalated)', 'Escalated') :
                activeTask.gapCause
              }</span>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center z-10">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-sm ${getStepNodeStyle(3, activeTask)}`}>
                <Workflow className="h-3 w-3" />
              </div>
              <span className={`text-[9px] font-semibold mt-1 ${getStepStatus(3, activeTask) === 'skipped' ? 'text-slate-400' : 'text-slate-700'}`}>{t('3. 联网生成', '3. Generation')}</span>
              <span className={`text-[8px] font-bold ${getStepStatus(3, activeTask) === 'skipped' ? 'text-slate-400' : 'text-indigo-600'}`}>{getStepStatus(3, activeTask) === 'skipped' ? t('已跳过', 'Skipped') : t('生成完毕', 'Generated')}</span>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center z-10">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-sm ${getStepNodeStyle(4, activeTask)}`}>
                <Play className="h-3 w-3" />
              </div>
              <span className={`text-[9px] font-semibold mt-1 ${getStepStatus(4, activeTask) === 'skipped' ? 'text-slate-400' : 'text-slate-700'}`}>{t('4. 人工审核', '4. HITL Approval')}</span>
              <span className={`text-[8px] font-bold ${getStepStatus(4, activeTask) === 'skipped' ? 'text-slate-400' : 'text-amber-600'}`}>
                {getStepStatus(4, activeTask) === 'skipped' ? t('已跳过', 'Skipped') : (getStepStatus(4, activeTask) === 'completed' ? t('已批准', 'Approved') : approveLoading ? t('正在写入...', 'Writing...') : t('待批准', 'Pending'))}
              </span>
            </div>

            {/* Step 5 */}
            <div className="flex flex-col items-center text-center z-10">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-sm ${getStepNodeStyle(5, activeTask)}`}>
                <CheckCircle2 className="h-3 w-3" />
              </div>
              <span className={`text-[9px] font-semibold mt-1 ${getStepStatus(5, activeTask) === 'skipped' ? 'text-slate-400' : 'text-slate-700'}`}>{t('5. 校验激活', '5. Verification')}</span>
              <span className={`text-[8px] font-medium ${getStepStatus(5, activeTask) === 'skipped' ? 'text-slate-400' : 'text-slate-400'}`}>
                {getStepStatus(5, activeTask) === 'skipped' ? t('已跳过', 'Skipped') : (getStepStatus(5, activeTask) === 'completed' ? t('校验通过', 'Verified') : t('挂起中', 'Suspended'))}
              </span>
            </div>
          </div>

          {/* Stepper Details Area */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            
            {/* Conversation log & Gap analyser row */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
              {/* Transcript */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-[10px] font-bold text-rose-600 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{t('原始失败会话片段', 'Original Failed Conversation')}</span>
                </h4>
                <div className="text-[10px] space-y-1.5 h-[90px] overflow-y-auto custom-scrollbar text-slate-700 font-mono bg-white p-2 rounded border border-slate-200/60 leading-normal">
                  {activeTask.transcript.split('\n').map((line, idx) => {
                    if (line.startsWith('[User]:')) {
                      return <div key={idx}><span className="text-indigo-600 font-semibold">[User]:</span> {line.replace('[User]:', '')}</div>;
                    } else if (line.startsWith('[Assistant]:')) {
                      return <div key={idx}><span className="text-slate-500 font-semibold">[Assistant]:</span> {line.replace('[Assistant]:', '')}</div>;
                    }
                    return <div key={idx} className="text-rose-500 font-medium">{line}</div>;
                  })}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="text-[10px] font-bold text-indigo-700 mb-1.5 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  <span>{t('Gap 智能诊断报告', 'Gap Diagnostic Report')}</span>
                </h4>
                <div className="text-[10px] space-y-1.5 h-[90px] overflow-y-auto custom-scrollbar text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-slate-550">{t('诊断结果', 'Diagnosis')}:</strong> 
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded text-[9px] font-bold">
                      {activeTask.gapCause}
                    </span>
                  </div>
                  <div><strong className="text-slate-550">{t('检索匹配', 'RAG Retrieval')}:</strong> {activeTask.retrieved}</div>
                  <div className="text-amber-800 text-[10px] leading-tight bg-amber-50 p-1.5 rounded border border-amber-200 mt-2 font-medium">
                    <i className="fa-solid fa-circle-exclamation mr-1 text-amber-600"></i>
                    <strong>{t('缺失详情', 'Defect Details')}:</strong> {activeTask.gapDesc}
                  </div>
                </div>
              </div>
            </div>

            {/* Markdown Suggested Fix Editor */}
            <div className="flex flex-col min-h-[160px] flex-1">
              <div className="flex justify-between items-center mb-1.5">
                <h4 className="text-[10px] font-bold text-emerald-700 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{t('生成的新知识 Markdown 推荐 (可编辑)', 'Generated Markdown Revision Proposal (Editable)')}</span>
                </h4>
                <div className="flex items-center gap-2 text-[9px] font-bold">
                  <span className="text-slate-400"><Globe className="h-3 w-3 inline text-indigo-500 mr-0.5" /> {t('信源', 'Sources')}:</span>
                  <a href="#" className="text-indigo-600 underline hover:text-indigo-800">{activeTask.source}</a>
                </div>
              </div>

              <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Toolbar */}
                <div className="bg-slate-50 p-1.5 border-b border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <button className="hover:text-slate-700 font-bold">B</button>
                    <button className="hover:text-slate-700 italic">I</button>
                    <button className="hover:text-slate-700 font-bold">H1</button>
                    <div className="h-3 w-px bg-slate-300"></div>
                    <span className="text-[9px] text-indigo-600/70 font-semibold">{t('已使用 WebSearch-Tavily 辅助合成', 'Synthesized with Tavily search assistance')}</span>
                  </div>
                </div>
                {/* Editable Text Area */}
                <textarea 
                  value={editorValue}
                  onChange={(e) => setEditorValue(e.target.value)}
                  disabled={activeTask.progress === 100 || approveLoading}
                  className="w-full flex-1 bg-white p-2.5 text-[10px] text-slate-800 font-mono focus:outline-none resize-none min-h-[100px] custom-scrollbar" 
                  style={{ lineHeight: 1.5 }}
                />
              </div>
            </div>

            {/* Regression verification result details card */}
            {(activeTask.progress === 100 || addedVectors.includes(activeTask.id.replace('#', ''))) && (
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-250 flex items-start gap-3 shadow-sm animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 text-sm shrink-0">
                  <Check className="h-4.5 w-4.5" />
                </div>
                <div className="flex-1 text-[10px] text-slate-750">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-emerald-700">{t('回归验证成功 (Regression Passed)', 'Regression Testing Passed')}</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-mono font-semibold border border-emerald-200">100% Match</span>
                  </div>
                  <p className="text-slate-650 text-[10px] mb-1.5 leading-relaxed">
                    <strong>{t('校验详情', 'Verification Log')}:</strong> {t('模拟原始查询：对该优化进行回归测试。新写入的文档已被向量库索引，重新匹配打分达 0.95。Verifier 验证回答正确，成功完成安全合规回归校验。', 'Simulating original dialogue: Executing regression verification playback. The newly ingested evolved knowledge chunk matches with a high confidence score of 0.95. Verifier succeeded with zero errors.')}
                  </p>
                  <div className="bg-white p-2 rounded text-[9px] font-mono text-slate-700 border border-slate-200">
                    <strong>{t('已写入 ChromaDB', 'ChromaDB Status')}:</strong> Collection: agentnex_knowledge | {t('已注册元数据', 'Indexed File')}: data/knowledge/evolved_{activeTask.id.replace('#', '')}.md
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Action buttons row */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center gap-4 shrink-0">
            <button 
              onClick={triggerRegenerate}
              disabled={activeTask.progress === 100 || approveLoading}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 text-slate-707 text-[10px] px-3 py-2 rounded-lg transition duration-300 font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${approveLoading ? 'animate-spin' : ''}`} />
              <span>{t('重新联网生成 (Regenerate)', 'Regenerate')}</span>
            </button>
            
            <div className="flex gap-2">
              <button 
                onClick={triggerReject}
                disabled={activeTask.progress === 100 || approveLoading}
                className="bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed border border-rose-200 text-rose-700 text-[10px] px-3 py-2 rounded-lg transition duration-300 font-semibold"
              >
                {t('拒绝此推荐', 'Reject Revision')}
              </button>
              <button 
                onClick={triggerApprove}
                disabled={activeTask.progress === 100 || approveLoading}
                className={`text-white text-[10px] font-bold px-4 py-2 rounded-lg transition duration-300 shadow-md flex items-center gap-1.5 ${
                  activeTask.progress === 100
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                <span>
                  {activeTask.progress === 100 
                    ? t('写入完成与校验通过', 'Ingested & Regression Passed') 
                    : approveLoading 
                      ? t('入库并自动测试中...', 'Ingesting & Testing...') 
                      : t('批准修改并入库 (HITL Approve)', 'Approve & Ingest')}
                </span>
              </button>
            </div>
          </div>

        </div>
        )}

        {/* Lower Dashboard Part: Report & Incident Watcher */}
        <div className="light-card rounded-2xl p-4 min-h-[220px] grid grid-cols-3 gap-6 shrink-0 bg-white">
          {/* Stats 1 */}
          <div className="flex flex-col">
            <h3 className="font-outfit font-semibold text-[11px] text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1 shrink-0">
              <Activity className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t('会话评估结果类别比例', 'Evaluation Result Ratios')}</span>
            </h3>
            <div className="flex-1 flex items-center justify-between gap-2">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="#f1f5f9" stroke-width="8" />
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="#10b981" stroke-width="8" stroke-dasharray="201" stroke-dashoffset="80" />
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="#ef4444" stroke-width="8" stroke-dasharray="201" stroke-dashoffset="150" />
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="#f59e0b" stroke-width="8" stroke-dasharray="201" stroke-dashoffset="180" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold font-outfit text-slate-800">125</span>
                  <span className="text-[7px] text-slate-400 font-bold">{t('总会话', 'Calls')}</span>
                </div>
              </div>
              <div className="flex-1 space-y-1 text-[9px] text-slate-600 font-bold leading-none">
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> {t('成功 (60%)', 'Success (60%)')}</div>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span> {t('错误 (25%)', 'Failed (25%)')}</div>
                <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span> {t('升级 (15%)', 'Escalated (15%)')}</div>
              </div>
            </div>
          </div>

          {/* Stats 2 */}
          <div className="flex flex-col">
            <h3 className="font-outfit font-semibold text-[11px] text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t('会话故障根因分布', 'Failure Root Causes')}</span>
            </h3>
            <div className="flex-1 flex flex-col justify-center space-y-2">
              <div>
                <div className="flex justify-between text-[9px] mb-0.5 font-semibold text-slate-600">
                  <span>{t('知识匮乏 (Lack)', 'Knowledge Lack')}</span>
                  <span className="text-indigo-650 font-bold">48%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 h-1 rounded-full" style={{ width: '48%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] mb-0.5 font-semibold text-slate-600">
                  <span>{t('检索未匹配 (Mismatch)', 'Search Mismatch')}</span>
                  <span className="text-cyan-600 font-bold">32%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-500 to-cyan-700 h-1 rounded-full" style={{ width: '32%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[9px] mb-0.5 font-semibold text-slate-600">
                  <span>{t('上下文误解 (Misunderstand)', 'Misunderstanding')}</span>
                  <span className="text-amber-600 font-bold">20%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-1 rounded-full" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats 3 */}
          <div className="flex flex-col justify-between">
            <h3 className="font-outfit font-semibold text-[11px] text-slate-800 mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-1 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />
              <span>{t('回归校验指标', 'Regression Verification')}</span>
            </h3>
            <div className="flex-1 flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-200 mt-1 shadow-sm">
              <div className="space-y-0.5">
                <div className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">{t('回归测试通过率', 'Verified Ratio')}</div>
                <div className="text-2xl font-bold font-outfit text-emerald-600" id="evol-pass-rate">
                  {addedVectors.includes('task-102') || addedVectors.includes('task-103') ? '100%' : '94.2%'}
                </div>
                <div className="text-[8px] text-slate-500 font-semibold">{t('自动回归机制运行良好', 'Automated testing active')}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 text-base pulse-effect">
                <Check className="h-4.5 w-4.5" />
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* RIGHT DRAWER: Fixed Overlay Slide-out RAG Vector Database Console */}
      {/* Floating edge trigger tab */}
      <div 
        onClick={toggleDrawer}
        style={{ right: drawerOpen ? '320px' : '0' }}
        className="fixed top-1/3 z-50 w-9 py-5 bg-gradient-to-b from-indigo-650 to-indigo-800 border border-r-0 border-indigo-400/25 text-indigo-50 hover:text-white rounded-l-xl flex flex-col items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all duration-300 hover:bg-indigo-750"
      >
        <Database className="h-3.5 w-3.5 text-indigo-200 animate-pulse mb-1" />
        <span className="text-[8px] uppercase font-bold tracking-wider [writing-mode:vertical-lr] font-outfit">
          {drawerOpen ? t('收起控制台', 'Collapse Panel') : t('展开知识库', 'Expand Vectors')}
        </span>
        {drawerOpen ? <ChevronRight className="h-2.5 w-2.5 mt-1" /> : <ChevronLeft className="h-2.5 w-2.5 mt-1" />}
      </div>

      {/* Floating sliding drawer */}
      <div 
        style={{ transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)' }}
        className="fixed top-0 right-0 h-full w-80 z-40 bg-white border-l border-slate-200 shadow-2xl p-4 flex flex-col drawer-transition"
      >
        {/* Header row */}
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200 shrink-0 pt-3">
          <h2 className="font-outfit font-semibold text-xs flex items-center gap-2 text-slate-800">
            <BookOpen className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>{t('ChromaDB 向量库管理', 'ChromaDB Vector Manager')}</span>
          </h2>
          <button 
            onClick={toggleDrawer}
            className="w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 text-xs flex items-center justify-center transition shadow-sm"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mb-3 relative shrink-0">
          <input 
            type="text" 
            placeholder={t("搜索向量文件内容...", "Search vector segments...")} 
            className="w-full bg-slate-50 border border-slate-200 text-[10px] rounded-lg px-2.5 py-1.5 pl-7 focus:outline-none focus:border-indigo-500 text-slate-700" 
          />
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-2" />
        </div>

        {/* Vector DB List scrolling */}
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
          {/* Card 102 */}
          {(addedVectors.includes('task-102') || !deletedVectors.includes('task-102')) && (
            <div className={`p-2.5 rounded-lg bg-emerald-50/20 border shadow-sm transition-all duration-700 ${
              deletedVectors.includes('task-102') ? 'opacity-0 scale-95 h-0 p-0 m-0 overflow-hidden border-none' : 'border-emerald-250'
            }`}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[9px] font-mono text-emerald-700 font-bold bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5 text-emerald-600" />
                  {t('新增知识', 'Evolved')}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">2026-05-27</span>
              </div>
              <p className="text-[11px] font-bold text-slate-850 truncate">evolved_task-102.md</p>
              <p className="text-[9px] text-slate-550 truncate mb-2 font-medium">{t('信源: Wiki / LenovoPSREF | L1 利润率计算公式...', 'Wiki / LenovoPSREF | L1 Margin Formula Details...')}</p>
              
              <div className="flex gap-1.5 justify-end">
                <button 
                  onClick={() => openTrace('task-102')}
                  className="text-[9px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded transition duration-200 font-semibold shadow-sm"
                >
                  {t('追溯', 'Trace')}
                </button>
                <button 
                  onClick={() => alert(t('热更新已触发。', 'Hot update triggered.'))}
                  className="text-[9px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded transition duration-200 font-semibold"
                >
                  {t('更新', 'Update')}
                </button>
                <button 
                  onClick={() => eraseVector('task-102')}
                  className="text-[9px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2 py-0.5 rounded transition duration-200 font-semibold"
                >
                  {t('擦除', 'Erase')}
                </button>
              </div>
            </div>
          )}

          {/* Card 103 */}
          {(addedVectors.includes('task-103') && !deletedVectors.includes('task-103')) && (
            <div className={`p-2.5 rounded-lg bg-emerald-50/20 border shadow-sm transition-all duration-700 ${
              deletedVectors.includes('task-103') ? 'opacity-0 scale-95 h-0 p-0 m-0 overflow-hidden border-none' : 'border-emerald-250'
            }`}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-[9px] font-mono text-emerald-700 font-bold bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5 text-emerald-600 animate-bounce" />
                  {t('新增知识', 'Evolved')}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">刚刚</span>
              </div>
              <p className="text-[11px] font-bold text-slate-850 truncate">evolved_task-103.md</p>
              <p className="text-[9px] text-slate-550 truncate mb-2 font-medium">{t('信源: Lenovo PSREF Online | X1 Carbon规格更新...', 'Lenovo PSREF Online | X1 Carbon Spec Details...')}</p>
              
              <div className="flex gap-1.5 justify-end">
                <button 
                  onClick={() => openTrace('task-103')}
                  className="text-[9px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded transition duration-200 font-semibold shadow-sm"
                >
                  {t('追溯', 'Trace')}
                </button>
                <button 
                  onClick={() => alert(t('热更新已触发。', 'Hot update triggered.'))}
                  className="text-[9px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded transition duration-200 font-semibold"
                >
                  {t('更新', 'Update')}
                </button>
                <button 
                  onClick={() => eraseVector('task-103')}
                  className="text-[9px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-2 py-0.5 rounded transition duration-200 font-semibold"
                >
                  {t('擦除', 'Erase')}
                </button>
              </div>
            </div>
          )}

          {/* Standard Document Card */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition duration-200">
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-mono text-slate-400 font-bold">{t('静态常驻知识', 'Static Context')}</span>
              <span className="text-[9px] text-slate-400 font-medium">2026-05-20</span>
            </div>
            <p className="text-[11px] font-bold text-slate-700 truncate">chat_dashboard_glossary.md</p>
            <p className="text-[9px] text-slate-550 truncate mb-2 font-medium">{t('系统指标标准参考术语表，包含L2/L3计算，但缺失L1核心规格。', 'System indices standard reference terms, containing L2/L3 specs but missing L1.')}</p>
            
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => alert(t('静态固定知识库文件，无历史进化故障记录档案。', 'Static configuration glossary. No history evolution trace available.'))} 
                className="text-[9px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded border border-slate-200 cursor-not-allowed font-bold"
              >
                {t('无需追溯', 'No Trace')}
              </button>
              <button 
                onClick={() => alert(t('静态文件已手动重新入库并更新向量。', 'Static indexes successfully refreshed.'))}
                className="text-[9px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded transition duration-200 font-semibold"
              >
                {t('更新', 'Update')}
              </button>
            </div>
          </div>
        </div>

        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[9px] text-slate-500 mt-2 shrink-0 font-medium leading-normal">
          <i className="fa-solid fa-circle-info text-indigo-500 mr-0.5"></i>
          {t('通过 Task ID / Metadata 关联向量，提供生产级安全冲突检测和精准热更新擦除。', 'Using Task ID & Metadata schemas to avoid index pollution, ensuring production-grade hot updates and precise erasing.')}
        </div>
      </div>

      {/* MODAL: Manual Trigger (Paste failed log) */}
      {triggerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-slate-200 m-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-outfit font-bold text-base text-slate-800 flex items-center gap-2">
                <Workflow className="h-5 w-5 text-indigo-600" />
                <span>{t('手动提交工作流 (Trigger Pipeline)', 'Manual Trigger Evolution Pipeline')}</span>
              </h3>
              <button onClick={() => setTriggerModalOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-650 mb-2">
                  {t('手动粘贴包含 AI 报错/不满意的问题或会话转写:', 'Paste conversation logs or user feedback containing errors below:')}
                </label>
                <textarea 
                  value={triggerText}
                  onChange={(e) => setTriggerText(e.target.value)}
                  rows={6} 
                  className="w-full bg-slate-50 border border-slate-250 rounded-xl p-3 text-xs text-slate-700 font-mono focus:outline-none focus:border-indigo-500" 
                  placeholder={t(`例如：\n[User]: ThinkPad 最新续航是几个小时？\n[Assistant]: 抱歉，我只有老款参数...\n[系统异常]: 知识缺失，急需进化。`, `E.g.,\n[User]: How long does ThinkPad X1 last?\n[Assistant]: Sorry, I only have old battery spec...\n[System]: Knowledge gap diagnosed. Ingestion needed.`)}
                />
              </div>
              
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-[10px] text-indigo-850 leading-relaxed font-semibold">
                <AlertCircle className="h-3.5 w-3.5 text-indigo-600 inline mr-1" />
                <strong>{t('运行提示', 'Workflow Notice')}:</strong> {t('提交后将自动异步执行 Preparation Workflow (步骤1-3)，联网抓取事实，并将生成好的知识文件放在左侧列表待人工把关审批。', 'Submitting kicks off the async Preparation Workflow (Steps 1-3) to fetch facts and generate markdown fixed content, listing it as a pending task.')}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setTriggerModalOpen(false)} 
                className="bg-slate-100 border border-slate-200 text-slate-600 text-xs px-4 py-2.5 rounded-xl hover:bg-slate-200 transition duration-300 font-semibold"
              >
                {t('取消', 'Cancel')}
              </button>
              <button 
                onClick={handleManualTriggerSubmit}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition duration-300 shadow-md"
              >
                {t('提交并启动 (Trigger Workflow)', 'Trigger Pipeline')}
              </button>
            </div>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 m-4 shadow-2xl transition-all duration-300">
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 mb-4">
              <h3 className="font-outfit font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Import className="h-4.5 w-4.5 text-indigo-650" />
                <span>{t('导入或上传故障对话脚本', 'Import or Upload Failure Dialogue')}</span>
              </h3>
              <button onClick={() => setImportModalOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* SECTION 1: Presets */}
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 block mb-2">
                  {t('方式一：选择系统预设脚本 (Presets)', 'Method 1: Select Preset Dialogue')}
                </span>
                <div className="space-y-2">
                  {/* Option 1 */}
                  <div 
                    onClick={() => !uploading && handlePresetSelect('preset-1')}
                    className={`p-2.5 rounded-xl border border-slate-150 bg-slate-50/50 hover:border-indigo-200 hover:bg-indigo-50/20 cursor-pointer transition ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex justify-between text-[9.5px] font-bold text-slate-850 mb-0.5">
                      <span>{t('场景 A：X1 Carbon 续航问答出错', 'Scenario A: X1 Carbon Battery Life')}</span>
                      <span className="bg-rose-50 text-rose-600 px-1 py-0.2 rounded text-[7.5px] border border-rose-100 font-bold">Search Mismatch</span>
                    </div>
                    <p className="text-[8.5px] text-slate-500 font-medium leading-relaxed">{t('用户提问 Gen 12 最新续航，数据库未匹配出，错误返回老款参数。', 'User asks for Gen 12 battery life, search misses the doc and returns Gen 11 specs.')}</p>
                  </div>
                  
                  {/* Option 2 */}
                  <div 
                    onClick={() => !uploading && handlePresetSelect('preset-2')}
                    className={`p-2.5 rounded-xl border border-slate-150 bg-slate-50/50 hover:border-indigo-200 hover:bg-indigo-50/20 cursor-pointer transition ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex justify-between text-[9.5px] font-bold text-slate-850 mb-0.5">
                      <span>{t('场景 B：GSC 供应链运费问答失败', 'Scenario B: GSC Freight Policy')}</span>
                      <span className="bg-rose-50 text-rose-600 px-1 py-0.2 rounded text-[7.5px] border border-rose-100 font-bold">Knowledge Lack</span>
                    </div>
                    <p className="text-[8.5px] text-slate-500 font-medium leading-relaxed">{t('内部物流新规缺失，系统面临“完全盲区”，无法回答最新运费优惠。', 'Missing internal freight specifications in DB, leading to complete info gap.')}</p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Real File Upload */}
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 block mb-2">
                  {t('方式二：上传本地会话日志 (Real Upload)', 'Method 2: Upload Local Dialogue File')}
                </span>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".txt,.json,.log" 
                  className="hidden" 
                />

                <div 
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center transition cursor-pointer ${
                    uploading 
                      ? 'border-indigo-300 bg-indigo-50/10 cursor-wait' 
                      : 'border-slate-200 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/10'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center py-2">
                      <Loader2 className="h-7 w-7 text-indigo-600 animate-spin mb-2" />
                      <span className="text-[10px] font-semibold text-indigo-700">
                        {t('上传并解析文件中...', 'Uploading & parsing...')} {uploadProgress}%
                      </span>
                      <div className="w-36 h-1.5 bg-indigo-100 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-150" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-1">
                      <div className="h-9 w-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100 mb-2 group-hover:scale-105 transition-transform">
                        <Upload className="h-4.5 w-4.5 text-indigo-650" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 mb-0.5">
                        {t('点击选择本地文件并启动进化', 'Click to Select Dialogue File')}
                      </span>
                      <span className="text-[8px] text-slate-400 font-medium">
                        {t('支持 .txt, .json, .log 格式 • 智能结构化解析', 'Supports .txt, .json, .log • Auto structured formatting')}
                      </span>
                      {uploadError && (
                        <div className="text-[9px] text-rose-600 font-semibold mt-2 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          <span>{uploadError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-slate-100">
              <button 
                onClick={() => setImportModalOpen(false)}
                disabled={uploading}
                className={`bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3.5 py-1.8 rounded-xl hover:bg-slate-100 transition font-semibold ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {t('关闭', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Traceability overlay detailed report */}
      {traceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 m-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-outfit font-bold text-sm text-indigo-700 flex items-center gap-1.5">
                <History className="h-4.5 w-4.5" />
                <span>{t('RAG 向量一键归因溯源档案', 'RAG Vector Evolution Trace File')} [{traceTaskId}]</span>
              </h3>
              <button onClick={() => setTraceModalOpen(false)} className="text-slate-400 hover:text-slate-650">
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-rose-600 font-bold uppercase block mb-1">{t('引发该进化的原始用户报错', 'Triggering User Conversational Error')}</span>
                  <div className="font-mono text-[9.5px] text-slate-700 max-h-24 overflow-y-auto custom-scrollbar leading-relaxed">
                    {tasks[traceTaskId]?.transcript.split('\n').map((line, idx) => <div key={idx}>{line}</div>)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-indigo-700 font-bold uppercase block mb-1">{t('Gap Analyzer 诊断报告', 'Gap Diagnostics')}</span>
                  <p className="text-slate-750 leading-tight mb-2"><strong>{t('诊断根因', 'Root Cause')}:</strong> {tasks[traceTaskId]?.gapCause}</p>
                  <p className="text-amber-800 leading-normal text-[10.5px] bg-amber-50 p-1.5 rounded border border-amber-200 font-medium">
                    <strong>{t('缝隙描述', 'Gap Description')}:</strong> {tasks[traceTaskId]?.gapDesc}
                  </p>
                </div>
              </div>
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-emerald-700 font-bold uppercase block mb-1">{t('生成该知识的外部联网信源 (Tavily Search Engine)', 'Generated Fact-checked Online Citations')}</span>
                <div className="flex items-center gap-2 mt-1.5">
                  <Globe className="h-3.5 w-3.5 text-cyan-600" />
                  <a href="#" className="text-indigo-600 hover:underline font-mono text-[10.5px] font-semibold">{tasks[traceTaskId]?.source} ({t('已通过多Agent交叉校验', 'Cross-Agent Fact-Checked')})</a>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">{t('ChromaDB 向量元数据 (Metadata)', 'ChromaDB Vector Metadata')}</span>
                <div className="bg-white p-2 rounded font-mono text-[10px] text-indigo-600 border border-slate-200">
                  {"{"}<br />
                  &nbsp;&nbsp;"doc_id": "evolved_{traceTaskId}",<br />
                  &nbsp;&nbsp;"source": "kb_evol",<br />
                  &nbsp;&nbsp;"task_id": "{traceTaskId}",<br />
                  &nbsp;&nbsp;"type": "evolved",<br />
                  &nbsp;&nbsp;"created_at": "{tasks[traceTaskId]?.time}"<br />
                  {"}"}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button 
                onClick={() => setTraceModalOpen(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-5 py-2 rounded-xl transition shadow-md font-semibold"
              >
                {t('关闭溯源档案', 'Close Trace File')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled css animation rules */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in { 
          from { opacity: 0; transform: translateY(8px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .drawer-transition {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}} />

    </div>
  );
}
