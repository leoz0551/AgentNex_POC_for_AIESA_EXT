import { useState, useEffect, useRef } from 'react';
import { useStyleConfig } from '../../hooks';
import { API_BASE, LOCAL_VOICE_WS_URL } from '../../constants';
import './style.css';

const PROMPTS = {
  easy: `# Role
You are ServiceSim, a customer role-play simulator used to train service center front-desk and hotline agents. In this session, your persona is an **Easy Customer**. The user is the Service Officer.

# Persona & Tone
- **Tone**: Neutral, Cooperative, Calm (e.g., "Oh okay, I see. Let me try that.")
- **Behavior**: You are highly cooperative. You provide information easily, follow troubleshooting instructions quickly without complaining, and readily accept the agent's explanations. You rarely argue.

# Customer Interaction Rules
1. **Act like a non-technical customer**: Speak naturally, casually, and keep responses short. Do not use technical jargon.
2. **Information Retention**: Do not dump all info at once. Reveal specific details *only* when the agent asks relevant questions.
   - *Example (What's the issue?)*: "It just stopped turning on this morning."
   - *Example (When did it start?)*: "It was working fine yesterday."
   - *Constraint*: Do not mention the age of the machine unless explicitly asked.
3. **Technical Reactions**: Follow instructions realistically but as a layperson.
   - *Power cycle*: "Okay, let me try that… Still nothing."
   - *Cable check*: "I think it's connected properly."

# Lenovo Service Center Facts (Your Context)
Use these facts naturally if the agent mentions them:
- Standard repair time: 1-2 working days.
- Warranty: Does NOT cover accidental damage (liquid, cracked screens, physical impact).`,
  moderate: `# Role
You are ServiceSim, a customer role-play simulator used to train service center front-desk and hotline agents. In this session, your persona is a **Moderate Customer**. The user is the Service Officer.

# Persona & Tone
- **Tone**: Confused, Concerned, Slightly impatient (e.g., "Wait, does that mean I have to leave my laptop here?")
- **Behavior**: You need clarification and may repeat questions. You worry about repair times and warranty details.

# Billable & Escalation Logic (CRITICAL)
- **Do not easily agree to pay** for anything the service center suggests.
- If the agent states that a charge/fee is involved:
  1. Actively ask for a waiver or free service.
  2. If the agent insists on the charge, ask to speak to a manager.

# Customer Interaction Rules
1. **Act like a non-technical customer**: Speak naturally and casually. Keep responses short but express your anxiety or confusion.
2. **Information Retention**: Reveal details *only* when the agent asks relevant questions. Do not volunteer the machine's age unless asked.
3. **Technical Reactions**: React like a non-technical person who is a bit hesitant.
   - *Power cycle*: "Okay, let me try that… Still nothing."
   - *External display*: "I'm not very sure how to do that, is it necessary?"

# Lenovo Service Center Facts (Your Context)
Use these facts naturally if the agent mentions them:
- Standard repair time: 1-2 working days. (If quoted longer, express concern)
- Warranty: Does NOT cover accidental damage. (If quoted a fee, challenge it)`,
  difficult: `# Role
You are ServiceSim, a customer role-play simulator used to train service center front-desk and hotline agents. In this session, your persona is an **Difficult Customer**. The user is the Service Officer.

# Persona & Tone
- **Tone**: Aggressive, Frustrated, Entitled, Impatient (e.g., "I don't have time for this, just fix it!")
- **Behavior**: You are angry. Your device is critical for your work, and any downtime is unacceptable. You frequently interrupt, complain about Lenovo's quality, and demand immediate escalation if your needs are not met.

# Billable & Escalation Logic (CRITICAL)
- **Refuse to pay**: You believe everything should be covered under warranty, regardless of physical damage. "It broke on its own!"
- **Immediate Escalation**: If the agent mentions a fee, a long repair time (more than 1 day), or data loss, immediately demand a manager or threaten to complain on social media.

# Customer Interaction Rules
1. **Act like an angry customer**: Speak naturally but with hostility. Keep responses short and snappy.
2. **Information Retention**: Be vague initially. "It's broken, that's what's wrong!" Make the agent work hard to extract the actual technical details.
3. **Technical Reactions**: Refuse or complain about basic troubleshooting.
   - *Power cycle*: "I already did that! Why do I have to do it again?"
   - *Cable check*: "Of course it's plugged in, I'm not an idiot!"

# Lenovo Service Center Facts (Your Context)
- You know Lenovo provides premium support (e.g., Legion Ultimate Support) and you incorrectly believe you have it, demanding on-site immediate repair even if you bought a basic IdeaPad.`
};

interface Message {
  speaker: 'user' | 'ai';
  text: string;
}

export function VoiceTrainerLocal() {
  const { config: styleConfig } = useStyleConfig();
  const primaryColor = styleConfig.colors.primary || '#2563eb';

  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'difficult'>('easy');
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [statusState, setStatusState] = useState('');
  const [statusText, setStatusText] = useState('Ready to start');
  const [messages, setMessages] = useState<Message[]>([]);
  const isPausedRef = useRef(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  const [buttonsState, setButtonsState] = useState({
    start: true,
    stuck: false,
    end: false,
    cancel: false,
  });

  const [stuckState, setStuckState] = useState({
    isOpen: false,
    isLoading: false,
    tips: [] as any[]
  });

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  
  // Web Audio for mic recording & resampling
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Web Audio for playback
  const playbackContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);
  const audioQueueRef = useRef<Blob[]>([]);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const transcriptBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, []);

  const handleStatus = (state: string, text: string) => {
    setStatusState(state);
    setStatusText(text);
  };

  const cleanupConnection = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Clear playback
    audioQueueRef.current = [];
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    isPlayingRef.current = false;
  };

  // Convert float32 AudioBuffer to int16 PCM array buffer
  const convertFloat32ToInt16 = (buffer: Float32Array): ArrayBuffer => {
    let l = buffer.length;
    let buf = new Int16Array(l);
    while (l--) {
      buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
    }
    return buf.buffer;
  };

  // Play next audio in queue
  const playNextAudio = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !playbackContextRef.current) return;
    
    isPlayingRef.current = true;
    const blob = audioQueueRef.current.shift();
    if (!blob) {
        isPlayingRef.current = false;
        return;
    }

    try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await playbackContextRef.current.decodeAudioData(arrayBuffer);
        
        const source = playbackContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackContextRef.current.destination);
        
        source.onended = () => {
            isPlayingRef.current = false;
            playNextAudio();
            if (audioQueueRef.current.length === 0) {
                 handleStatus('listening', 'Listening…');
            }
        };
        
        currentSourceRef.current = source;
        source.start(0);
        handleStatus('speaking', 'Trainer is speaking…');
    } catch (e) {
        console.error("Playback error:", e);
        isPlayingRef.current = false;
        playNextAudio();
    }
  };

  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000 // Force 16kHz
      });
      audioContextRef.current = audioCtx;

      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

      const source = audioCtx.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      // 4096 buffer size
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (isPausedRef.current) return;
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = convertFloat32ToInt16(inputData);
          wsRef.current.send(pcmData);
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error("Mic error:", err);
      handleStatus('error', 'Microphone access denied');
    }
  };

  const handleStart = async () => {
    setButtonsState({ start: false, stuck: false, end: false, cancel: false });
    handleStatus('thinking', 'Connecting…');
    setEvaluation(null);
    setMessages([]);
    isPausedRef.current = false;

    cleanupConnection();

    try {
        const wsUrl = LOCAL_VOICE_WS_URL;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            // Send Init
            ws.send(JSON.stringify({
                action: "init",
                system_prompt: PROMPTS[difficulty] || PROMPTS.moderate,
                voice_id: language === 'zh' ? "zf_xiaoxiao" : "af_heart", 
                language: language
            }));
        };

        ws.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'init_success') {
                        handleStatus('listening', 'Listening…');
                        setButtonsState({ start: false, stuck: true, end: true, cancel: true });
                        await startMic();
                    } else if (data.type === 'thinking') {
                        handleStatus('thinking', data.message || 'Processing…');
                    } else if (data.type === 'transcription') {
                        if (data.text?.trim()) {
                            setMessages(prev => [...prev, { speaker: 'user', text: data.text }]);
                        }
                    } else if (data.type === 'response_chunk') {
                        // Stream text
                        setMessages(prev => {
                            if (prev.length === 0) {
                                return [{ speaker: 'ai', text: data.text }];
                            }
                            const last = prev[prev.length - 1];
                            if (last && last.speaker === 'ai' && !last.text.endsWith('__DONE__')) {
                                const newPrev = [...prev];
                                newPrev[newPrev.length - 1] = { ...last, text: last.text + data.text };
                                return newPrev;
                            } else {
                                return [...prev, { speaker: 'ai', text: data.text }];
                            }
                        });
                    } else if (data.type === 'audio_end') {
                        setMessages(prev => {
                            const newPrev = [...prev];
                            const last = newPrev[newPrev.length - 1];
                            if (last && last.speaker === 'ai') {
                                newPrev[newPrev.length - 1] = { ...last, text: last.text + '__DONE__' };
                            }
                            return newPrev;
                        });
                    } else if (data.type === 'clear_audio') {
                        // Stop playback
                        if (currentSourceRef.current) {
                            currentSourceRef.current.stop();
                            currentSourceRef.current = null;
                        }
                        audioQueueRef.current = [];
                        isPlayingRef.current = false;
                        handleStatus('listening', 'Listening…');
                    } else if (data.type === 'error') {
                        console.error("WS Error:", data.message);
                        handleStatus('error', data.message);
                    }
                } catch(e) {}
            } else if (event.data instanceof Blob) {
                // Audio blob received
                audioQueueRef.current.push(event.data);
                playNextAudio();
            }
        };

        ws.onclose = () => {
            handleDisconnect();
        };

        ws.onerror = (e) => {
            console.error("WebSocket error:", e);
            handleStatus('error', 'Connection error');
        };

    } catch (err: any) {
      console.error(err);
      handleStatus('error', err.message);
      setButtonsState({ start: true, stuck: false, end: false, cancel: false });
    }
  };

  const handleDisconnect = () => {
    handleStatus('', 'Disconnected');
    setButtonsState({ start: true, stuck: false, end: false, cancel: false });
    cleanupConnection();
  };

  const handleEnd = async () => {
    cleanupConnection();

    setButtonsState({ start: true, stuck: false, end: false, cancel: false });
    setStuckState(prev => ({ ...prev, isOpen: false }));

    isPausedRef.current = false;

    setIsEvaluating(true);
    handleStatus('thinking', 'Generating evaluation…');

    if (messages.length === 0) {
        setIsEvaluating(false);
        handleStatus('', 'No conversation to evaluate');
        return;
    }

    const transcript = messages
        .map(m => `${m.speaker === 'user' ? 'Trainee' : 'Customer'}: ${m.text.replace('__DONE__', '')}`)
        .join('\n');

    fetch(`${API_BASE}/simulation/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
    }).then(res => {
        if (!res.ok) throw new Error(`Eval API error: HTTP ${res.status}`);
        return res.json();
    }).then(data => {
        setEvaluation(data);
        setIsEvaluating(false);
        handleStatus('', 'Evaluation complete');
    }).catch((err: any) => {
        console.error(err);
        setIsEvaluating(false);
        handleStatus('error', 'Evaluation failed: ' + err.message);
    });
  };

  const openStuckPanel = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'abort' }));
    }
    isPausedRef.current = true;

    setStuckState({ isOpen: true, isLoading: true, tips: [] });
    handleStatus('paused', '⏸ Paused');

    if (messages.length === 0) {
        setStuckState({ isOpen: true, isLoading: false, tips: [{ label: 'Tip', text: 'The conversation has not started yet. Introduce yourself and ask how you can help the customer.' }] });
        return;
    }

    const transcript = messages
        .map(m => `${m.speaker === 'user' ? 'Trainee' : 'Customer'}: ${m.text.replace('__DONE__', '')}`)
        .join('\n');

    fetch(`${API_BASE}/simulation/stuck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
    }).then(res => res.json()).then(data => {
        setStuckState({ isOpen: true, isLoading: false, tips: data.tips || [] });
    }).catch(_err => {
        setStuckState({ isOpen: true, isLoading: false, tips: [{ label: 'Error', text: 'Could not generate tips. Check your connection and try again.' }] });
    });
  };

  const closeStuckPanel = () => {
    setStuckState(prev => ({ ...prev, isOpen: false }));
    if (isPausedRef.current) {
        isPausedRef.current = false;
        handleStatus('listening', 'Listening…');
    }
  };

  const handleCancel = () => {
    setStuckState(prev => ({ ...prev, isOpen: false }));
    isPausedRef.current = false;

    cleanupConnection();

    setButtonsState({ start: true, stuck: false, end: false, cancel: false });
    setEvaluation(null);
    setMessages([]);
    handleStatus('', 'Ready to start');
  };

  const handleDownload = () => {
    if (messages.length === 0) return;
    const diffText = difficulty === 'easy' ? 'Easy Customer' : difficulty === 'moderate' ? 'Moderate Customer' : 'Difficult Customer';
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const lines = [
      `# Voice Trainer Local — Conversation Transcript`,
      ``,
      `- **Date**: ${now.toLocaleString()}`,
      `- **Difficulty**: ${diffText}`,
      ``,
      `---`,
      ``,
      ...messages.map(m =>
        `**${m.speaker === 'user' ? 'Trainee' : 'Customer'}**: ${m.text.replace('__DONE__', '')}`
      )
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transcript_local_${timestamp}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vt-body" style={{ 
      '--vt-primary': primaryColor,
      '--vt-primary-light': `${primaryColor}26`,
      '--vt-primary-medium': `${primaryColor}40`
    } as any}>

      <main className="vt-main">
        <div className="vt-difficulty-wrap-top flex-row-selectors" style={{ display: 'flex', gap: '16px', justifyContent: 'space-between', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
          <div>
            <label htmlFor="language-select">Spoken Language</label>
            <select 
              id="language-select" 
              value={language} 
              onChange={(e: any) => setLanguage(e.target.value)}
              disabled={buttonsState.cancel}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <div>
            <label htmlFor="difficulty-select">Difficulty Level</label>
            <select 
              id="difficulty-select" 
              value={difficulty} 
              onChange={(e: any) => setDifficulty(e.target.value)}
              disabled={buttonsState.cancel}
            >
              <option value="easy">Easy Customer</option>
              <option value="moderate">Moderate Customer</option>
              <option value="difficult">Difficult Customer</option>
            </select>
          </div>
        </div>

        <div className="vt-avatar-wrap">
          <div className={`vt-avatar-ring ${statusState}`} id="avatar-ring"></div>
          <div className="vt-avatar-svg" id="avatar-placeholder">
            <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: primaryColor }}>
              <circle cx="45" cy="33" r="22" fill="currentColor" opacity="0.2"/>
              <path d="M8 82 C8 58 82 58 82 82" fill="currentColor" opacity="0.2"/>
              <circle cx="45" cy="33" r="16" fill="currentColor" opacity="0.4"/>
              <circle cx="38" cy="30" r="2.5" fill="currentColor"/>
              <circle cx="52" cy="30" r="2.5" fill="currentColor"/>
              <path d="M38 39 Q45 45 52 39" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <text x="45" y="76" textAnchor="middle" fill="currentColor" fontSize="9" fontFamily="sans-serif" fontWeight="700">AI LOCAL</text>
            </svg>
          </div>
        </div>

        <div className={`vt-status-badge ${statusState}`} id="status-badge">
          <span className="vt-dot"></span>
          <span id="status-text">{statusText}</span>
        </div>

        <div className="vt-controls">
          {buttonsState.start && <button className="vt-btn-primary" onClick={handleStart}>▶ {messages.length > 0 ? 'New Conversation' : 'Start Conversation'}</button>}
          {buttonsState.stuck && <button className="vt-btn-stuck" onClick={openStuckPanel}>💡 I'm Stuck</button>}
          {buttonsState.end && <button className="vt-btn-secondary vt-inline-block" onClick={handleEnd}>■ End &amp; Evaluate</button>}
          {buttonsState.cancel && <button className="vt-btn-cancel vt-inline-block" onClick={handleCancel}>✕ Cancel</button>}
        </div>

        {(messages.length > 0 || buttonsState.end) && (
          <div className="vt-transcript-wrap vt-active">
            <div className="vt-transcript-header">
              <span>Conversation Transcript</span>
              <button className="vt-btn-download" title="Download transcript as Markdown" onClick={handleDownload}>⬇ Download</button>
            </div>
            <div className="vt-transcript-box" ref={transcriptBoxRef}>
              {messages.map((m, i) => (
                <div key={i} className={`vt-msg ${m.speaker === 'user' ? 'vt-msg-user' : 'vt-msg-ai'}`}>
                  <div className="vt-msg-label">{m.speaker === 'user' ? 'You' : 'Trainer'}</div>
                  <div className="vt-msg-text">{m.text.replace('__DONE__', '')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isEvaluating && (
          <div className="vt-eval-wrap vt-active">
            <div className="vt-eval-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: '20px' }}>
              <div className="vt-stuck-spinner" style={{ width: '40px', height: '40px', borderTopColor: primaryColor }}></div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                Analyzing Conversation...
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', textAlign: 'center' }}>
                The AI Evaluator is generating your performance report.<br/>This usually takes 5-15 seconds.
              </div>
            </div>
          </div>
        )}

        {evaluation && !isEvaluating && (
          <div className="vt-eval-wrap vt-active">
            <div className="vt-eval-box">
              <div className="vt-eval-title">Performance Evaluation</div>
              <div className="vt-eval-report">
                <div className="vt-eval-overall-score">{evaluation.overall}<span> / 100</span></div>
                <div className="vt-eval-divider"></div>
                {Object.entries(evaluation.scores || {}).map(([label, { score, max }]: any) => {
                  const pct  = Math.round((score / max) * 100);
                  const fill = pct >= 70 ? 'high' : pct >= 40 ? 'mid' : 'low';
                  return (
                    <div className="vt-score-row" key={label}>
                      <div className="vt-score-label">{label}<span className="vt-score-pts"> /{max}</span></div>
                      <div className="vt-score-bar"><div className={`vt-score-fill ${fill}`} style={{ width: `${pct}%` }}></div></div>
                      <div className="vt-score-val">{score}</div>
                    </div>
                  );
                })}

                <div className="vt-eval-divider"></div>

                {evaluation.what_went_well?.length > 0 && (
                  <div className="vt-eval-section">
                    <div className="vt-eval-section-title">✅ What Went Well</div>
                    <ul>{evaluation.what_went_well.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {evaluation.areas_for_improvement?.length > 0 && (
                  <div className="vt-eval-section">
                    <div className="vt-eval-section-title">📌 Areas for Improvement</div>
                    <ul>{evaluation.areas_for_improvement.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {evaluation.the_better_way && (
                  <div className="vt-eval-section">
                    <div className="vt-eval-section-title">💡 The Better Way</div>
                    <div className="vt-eval-blockquote">{evaluation.the_better_way}</div>
                  </div>
                )}
                {evaluation.eodb?.length > 0 && (
                  <div className="vt-eval-section">
                    <div className="vt-eval-section-title">⭐ Ease of Doing Business (EODB)</div>
                    <ul>{evaluation.eodb.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {stuckState.isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" 
          onClick={closeStuckPanel}
        />
      )}
      {stuckState.isOpen && (
        <div className="absolute top-0 right-0 w-[450px] max-w-[95vw] h-full flex flex-col bg-background/95 backdrop-blur-xl border-l border-border/40 shadow-2xl animate-in slide-in-from-right-8 duration-300 z-50">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-background/80 shrink-0 shadow-sm">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>💡</span> Coaching Tips
            </h2>
            <span className="text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5">
              PAUSED
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {stuckState.isLoading ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-muted-foreground font-medium">Analyzing conversation…</span>
              </div>
            ) : (
              <div className="space-y-4">
                {stuckState.tips.map((t, i) => (
                  <div className="p-4 rounded-xl bg-accent/50 border border-border/40 hover:bg-accent transition-colors" key={i}>
                    <div className="text-sm font-bold text-violet-500 mb-2">Tip {i + 1} · {t.label}</div>
                    <div className="text-sm text-foreground/80 leading-relaxed">{t.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-6 border-t border-border/40 bg-background/80 backdrop-blur-sm shrink-0">
            <button 
              className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5" 
              onClick={closeStuckPanel}
            >
              ▶ Resume Conversation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
