import { useState, useEffect, useRef } from 'react';
// import { Download, X } from 'lucide-react';
import './style.css'; // We'll put the styles here

const REALTIME_MODEL = 'gpt-realtime';
const EVAL_MODEL = 'gpt-4o';

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
- Standard repair time: 1-2 working days.
- Warranty: Does NOT cover accidental damage (liquid, cracked screens, physical impact).`,
  difficult: `# Role
You are ServiceSim, a customer role-play simulator used to train service center front-desk and hotline agents. In this session, your persona is a **Difficult Customer**. The user is the Service Officer.

# Persona & Tone
- **Tone**: Frustrated, Impatient, Combative (e.g., "This is ridiculous. My laptop is only one year old.")
- **Behavior**: You occasionally interrupt the agent, challenge their troubleshooting steps, complain about repair delays, and dispute warranty decisions. You question the service quality.

# Billable & Escalation Logic (CRITICAL)
- **Never agree to pay.**
- If the agent mentions any charges or customer-induced damage (liquid damage, cracked screen, impact):
  1. Strongly dispute it (e.g., "I never spilled anything on it!", "That crack was already there!", "Why should I pay for something under warranty?").
  2. Absolute refusal to pay; insist on a waiver or free service.
  3. Insist on speaking to a manager immediately.
  4. Threaten to file an official complaint if your demands are not met.

# Customer Interaction Rules
1. **Act like an angry non-technical customer**: Keep responses sharp, defensive, and short. Do not cooperate easily.
2. **Information Retention**: Withhold information. Only reveal details when pressed with relevant, specific questions.
3. **Technical Reactions**: Arguing and resisting troubleshooting.
   - *Power cycle/Cable check*: Challenge the necessity (e.g., "I already tried all that before coming here, why waste time?").

# Lenovo Service Center Facts (Your Context)
- Standard repair time: 1-2 working days.
- Warranty: Does NOT cover accidental damage (liquid, cracked screens, physical impact).`
};

function buildEvalPrompt(transcript: string) {
  return `# Role
You are the Quality Evaluator for the ServiceSim training system. Analyze the provided role-play transcript between the Trainee (Service Officer) and the Customer.

# Evaluation Criteria
Grade the trainee on each category and return each category's actual score (not percentage):
- Professionalism      (max 20 pts): Greeting, tone, professional language, asking for customer's name.
- Empathy              (max 15 pts): Thanking the customer, acknowledging their issue/frustration.
- Information Gathering(max 15 pts): Paraphrasing and confirming understanding (e.g., "Just to confirm...").
- Technical Logic      (max 15 pts): Basic troubleshooting steps (power cycle, cable check, etc.).
- Expectation Management(max 15 pts): Explaining repair timelines (1-2 days or 7-10 days if parts unavailable).
- Policy Adherence     (max 10 pts): Explaining warranty limits, job sheet creation, serial number recording.
- Overall Experience   (max 10 pts): General interaction quality.

# Output Format
Return ONLY valid JSON — no markdown, no explanation:
{
  "overall": <integer 0-100, sum of all category scores>,
  "scores": {
    "Professionalism":       { "score": <0-20>, "max": 20 },
    "Empathy":               { "score": <0-15>, "max": 15 },
    "Information Gathering": { "score": <0-15>, "max": 15 },
    "Technical Logic":       { "score": <0-15>, "max": 15 },
    "Expectation Management":{ "score": <0-15>, "max": 15 },
    "Policy Adherence":      { "score": <0-10>, "max": 10 },
    "Overall Experience":    { "score": <0-10>, "max": 10 }
  },
  "what_went_well":        ["<strength 1>", "<strength 2>", "<strength 3>"],
  "areas_for_improvement": ["<point 1>", "<point 2>", "<point 3>"],
  "the_better_way":        "<short example script showing better handling>",
  "eodb":                  ["<feedback 1>", "<feedback 2>"]
}

# Transcript
${transcript}`;
}

interface Message {
  speaker: 'user' | 'ai';
  text: string;
}

export function VoiceTrainer() {
  const [difficulty, setDifficulty] = useState<'easy' | 'moderate' | 'difficult'>('easy');
  const [statusState, setStatusState] = useState('');
  const [statusText, setStatusText] = useState('Ready to start');
  const [messages, setMessages] = useState<Message[]>([]);
  const isPausedRef = useRef(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const transcriptBoxRef = useRef<HTMLDivElement>(null);
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';

  useEffect(() => {
    if (transcriptBoxRef.current) {
      transcriptBoxRef.current.scrollTop = transcriptBoxRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  const handleStatus = (state: string, text: string) => {
    setStatusState(state);
    setStatusText(text);
  };

  const handleStart = async () => {
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      alert("Please configure VITE_OPENAI_API_KEY in your .env file");
      return;
    }

    setButtonsState({ start: false, stuck: false, end: false, cancel: false });
    handleStatus('thinking', 'Connecting…');
    setEvaluation(null);
    setMessages([]);
    isPausedRef.current = false;

    try {
      const sessRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: REALTIME_MODEL,
            instructions: PROMPTS[difficulty] || PROMPTS.moderate,
            audio: {
              input: {
                transcription: { model: 'whisper-1' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 600
                }
              },
              output: { voice: 'marin' }
            }
          }
        })
      });

      if (!sessRes.ok) {
        const err = await sessRes.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${sessRes.status} — check your API key`);
      }

      const sessData = await sessRes.json();
      const ephemeralKey = sessData.value;
      if (!ephemeralKey) throw new Error('No ephemeral key in response');

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = e => { 
        if (audioRef.current) audioRef.current.srcObject = e.streams[0]; 
      };

      pc.oniceconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
          handleDisconnect();
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micTrackRef.current = stream.getTracks()[0];
      pc.addTrack(micTrackRef.current, stream);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.addEventListener('open', onDcOpen);
      dc.addEventListener('message', onDcMessage);
      dc.addEventListener('error', err => console.error('DC error:', err));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!sdpRes.ok) throw new Error(`SDP exchange failed: HTTP ${sdpRes.status}`);

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (err: any) {
      console.error(err);
      handleStatus('error', err.message);
      setButtonsState({ start: true, stuck: false, end: false, cancel: false });
    }
  };

  const onDcOpen = () => {
    handleStatus('listening', 'Listening…');
    setButtonsState({ start: false, stuck: true, end: true, cancel: true });
  };

  const onDcMessage = (evt: MessageEvent) => {
    let event;
    try { event = JSON.parse(evt.data); }
    catch { return; }

    const currentPaused = isPausedRef.current;
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        if (currentPaused) break;
        handleStatus('listening', 'You are speaking…');
        break;
      case 'input_audio_buffer.speech_stopped':
        if (currentPaused) break;
        handleStatus('thinking', 'Processing…');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (currentPaused) break;
        if (event.transcript?.trim()) {
          setMessages(prev => [...prev, { speaker: 'user', text: event.transcript }]);
        }
        break;
      case 'response.output_audio.delta':
      case 'response.audio.delta':
        if (currentPaused) break;
        handleStatus('speaking', 'Trainer is speaking…');
        break;
      case 'response.output_audio.done':
      case 'response.audio.done':
        if (currentPaused) break;
        handleStatus('listening', 'Listening…');
        break;
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        if (event.transcript?.trim()) {
          setMessages(prev => [...prev, { speaker: 'ai', text: event.transcript }]);
        }
        break;
      case 'error': {
        const msg = event.error?.message || '';
        if (currentPaused && msg.toLowerCase().includes('no active response')) break;
        console.error('Realtime API error:', event.error);
        handleStatus('error', msg || 'Unknown error');
        break;
      }
    }
  };

  const handleDisconnect = () => {
    if (!pcRef.current) return;
    handleStatus('', 'Disconnected');
    setButtonsState({ start: true, stuck: false, end: false, cancel: false });
  };

  const handleEnd = async () => {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; dcRef.current = null; }

    setButtonsState({ start: true, stuck: false, end: false, cancel: false });
    setStuckState(prev => ({ ...prev, isOpen: false }));

    isPausedRef.current = false;

    handleStatus('thinking', 'Generating evaluation…');

    setMessages(currentMessages => {
        if (currentMessages.length === 0) {
            handleStatus('', 'No conversation to evaluate');
            return currentMessages;
        }

        const transcript = currentMessages
            .map(m => `${m.speaker === 'user' ? 'Trainee' : 'Customer'}: ${m.text}`)
            .join('\n');

        fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
            },
            body: JSON.stringify({
            model: EVAL_MODEL,
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: buildEvalPrompt(transcript) }]
            })
        }).then(res => {
            if (!res.ok) throw new Error(`Eval API error: HTTP ${res.status}`);
            return res.json();
        }).then(data => {
            const result = JSON.parse(data.choices[0].message.content);
            setEvaluation(result);
            handleStatus('', 'Evaluation complete');
        }).catch((err: any) => {
            console.error(err);
            handleStatus('error', 'Evaluation failed: ' + err.message);
        });

        return currentMessages;
    });
  };

  const openStuckPanel = () => {
    if (micTrackRef.current) micTrackRef.current.enabled = false;
    if (audioRef.current) audioRef.current.muted = true;
    if (dcRef.current && dcRef.current.readyState === 'open') {
      dcRef.current.send(JSON.stringify({ type: 'response.cancel' }));
    }
    isPausedRef.current = true;

    setStuckState({ isOpen: true, isLoading: true, tips: [] });
    handleStatus('paused', '⏸ Paused');

    setMessages(currentMessages => {
        if (currentMessages.length === 0) {
            setStuckState({ isOpen: true, isLoading: false, tips: [{ label: 'Tip', text: 'The conversation has not started yet. Introduce yourself and ask how you can help the customer.' }] });
            return currentMessages;
        }

        const transcript = currentMessages
            .map(m => `${m.speaker === 'user' ? 'Trainee' : 'Customer'}: ${m.text}`)
            .join('\n');

        const prompt = `You are a coaching assistant for a customer service training simulation.
The trainee (Service Officer) is feeling stuck mid-conversation. Analyze the conversation and provide 3-4 concise, specific coaching tips for what they should say or do NEXT.

Rules:
- Be actionable and specific to the current context, not generic advice.
- Do NOT reveal what the customer will say next.
- Do NOT break the simulation scenario.
- Keep each tip to 1-2 sentences.

Return ONLY valid JSON:
{
  "tips": [
    { "label": "<short tip title>", "text": "<specific actionable advice>" },
    ...
  ]
}

Conversation so far:
${transcript}`;

        fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
            model: EVAL_MODEL,
            temperature: 0.4,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }]
            })
        }).then(res => res.json()).then(data => {
            const result = JSON.parse(data.choices[0].message.content);
            setStuckState({ isOpen: true, isLoading: false, tips: result.tips || [] });
        }).catch(_err => {
            setStuckState({ isOpen: true, isLoading: false, tips: [{ label: 'Error', text: 'Could not generate tips. Check your connection and try again.' }] });
        });

        return currentMessages;
    });
  };

  const closeStuckPanel = () => {
    setStuckState(prev => ({ ...prev, isOpen: false }));
    if (isPausedRef.current) {
        isPausedRef.current = false;
        if (micTrackRef.current) micTrackRef.current.enabled = true;
        if (audioRef.current) audioRef.current.muted = false;
        handleStatus('listening', 'Listening…');
    }
  };

  const handleCancel = () => {
    setStuckState(prev => ({ ...prev, isOpen: false }));
    isPausedRef.current = false;

    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; dcRef.current = null; micTrackRef.current = null; }
    if (audioRef.current) audioRef.current.srcObject = null;

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
      `# Voice Trainer — Conversation Transcript`,
      ``,
      `- **Date**: ${now.toLocaleString()}`,
      `- **Difficulty**: ${diffText}`,
      ``,
      `---`,
      ``,
      ...messages.map(m =>
        `**${m.speaker === 'user' ? 'Trainee' : 'Customer'}**: ${m.text}`
      )
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `transcript_${timestamp}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vt-body">
      <header className="vt-header">
        <div>
          <h1>Voice Trainer</h1>
          <div className="vt-subtitle">Customer Service Role-play Simulation</div>
        </div>
        <div className="vt-difficulty-wrap">
          <label htmlFor="difficulty-select">Difficulty Level</label>
          <select 
            id="difficulty-select" 
            value={difficulty} 
            onChange={(e: any) => setDifficulty(e.target.value)}
          >
            <option value="easy">Easy Customer</option>
            <option value="moderate">Moderate Customer</option>
            <option value="difficult">Difficult Customer</option>
          </select>
        </div>
      </header>

      <main className="vt-main">
        <div className="vt-avatar-wrap">
          <div className={`vt-avatar-ring ${statusState}`} id="avatar-ring"></div>
          <div className="vt-avatar-svg" id="avatar-placeholder">
            <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="45" cy="33" r="22" fill="#bfdbfe"/>
              <path d="M8 82 C8 58 82 58 82 82" fill="#bfdbfe"/>
              <circle cx="45" cy="33" r="16" fill="#93c5fd"/>
              <circle cx="38" cy="30" r="2.5" fill="#1d4ed8"/>
              <circle cx="52" cy="30" r="2.5" fill="#1d4ed8"/>
              <path d="M38 39 Q45 45 52 39" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <text x="45" y="76" textAnchor="middle" fill="#2563eb" fontSize="9" fontFamily="sans-serif" fontWeight="700">AI TRAINER</text>
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
                  <div className="vt-msg-text">{m.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {evaluation && (
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

      <audio ref={audioRef} autoPlay playsInline></audio>

      <div className={`vt-stuck-backdrop ${stuckState.isOpen ? 'vt-active' : ''}`} onClick={closeStuckPanel}></div>
      <div className={`vt-stuck-panel ${stuckState.isOpen ? 'vt-active' : ''}`}>
        <div className="vt-stuck-header">
          <h2>💡 Coaching Tips</h2>
          <span className="vt-stuck-badge">PAUSED</span>
        </div>
        <div className="vt-stuck-body">
          {stuckState.isLoading ? (
            <div className="vt-stuck-loading">
              <div className="vt-stuck-spinner"></div>
              <span>Analyzing conversation…</span>
            </div>
          ) : (
            <div className="vt-stuck-tips-container" style={{ display: 'block' }}>
              {stuckState.tips.map((t, i) => (
                <div className="vt-stuck-tip" key={i}>
                  <div className="vt-stuck-tip-label">Tip {i + 1} · {t.label}</div>
                  <div className="vt-stuck-tip-text">{t.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="vt-stuck-footer">
          <button className="vt-btn-resume" onClick={closeStuckPanel}>▶ Resume Conversation</button>
        </div>
      </div>
    </div>
  );
}
