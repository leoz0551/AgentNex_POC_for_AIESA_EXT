import { useState, useRef } from 'react';
import { chatApi } from '../api/chat';

export function useCourse() {
  const [showCourse, setShowCourse] = useState(false);
  const [courseData, setCourseData] = useState<any>(null);
  const [isCourseLoading, setIsCourseLoading] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const playNextAudio = async () => {
    if (audioQueueRef.current.length === 0) {
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED || wsRef.current.readyState === WebSocket.CLOSING) {
        setIsPlayingVoice(false);
      }
      return;
    }
    
    // Only play if not currently playing
    if (audioRef.current && !audioRef.current.paused) {
      return;
    }

    const blob = audioQueueRef.current.shift();
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audioRef.current = audio;
    }
    
    audio.src = url;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      playNextAudio();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      playNextAudio();
    };
    
    try {
      await audio.play();
    } catch (e) {
      console.error('Audio play error:', e);
      playNextAudio();
    }
  };

  const handleVoiceExplain = () => {
    if (!courseData) return;
    
    if (isPlayingVoice) {
      // Stop playing
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: "abort" }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      audioQueueRef.current = [];
      setIsPlayingVoice(false);
      return;
    }

    setIsVoiceLoading(true);
    
    let voiceUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://127.0.0.1:8005';
    if (voiceUrl.includes('127.0.0.1') || voiceUrl.includes('0.0.0.0')) {
      const portMatch = voiceUrl.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '8005';
      voiceUrl = `ws://${window.location.hostname}:${port}`;
    }

    const ws = new WebSocket(`${voiceUrl}/ws/v1/tts`);
    ws.binaryType = 'blob';
    wsRef.current = ws;

    ws.onopen = () => {
      setIsVoiceLoading(false);
      setIsPlayingVoice(true);
      
      const extractText = (obj: any, keyName?: string): string => {
        if (typeof obj === 'string') return obj;
        if (Array.isArray(obj)) {
          const arrText = obj.map(item => extractText(item)).join('\n');
          return keyName === 'learning_objectives' ? `Learning Objectives\n${arrText}` : arrText;
        }
        if (typeof obj === 'object' && obj !== null) {
          return Object.entries(obj)
            .filter(([key]) => key !== 'time_estimate') // 略过无需朗读的预估时间
            .map(([key, val]) => extractText(val, key))
            .join('\n');
        }
        return '';
      };
      
      const textToRead = extractText(courseData);
      console.log('Sending text to voice service:', textToRead);
      
      ws.send(JSON.stringify({ text: textToRead }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        audioQueueRef.current.push(event.data);
        playNextAudio();
      } else {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "tts_end") {
            console.log("TTS Finished stream");
          }
        } catch (e) {}
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setIsVoiceLoading(false);
      setIsPlayingVoice(false);
    };

    ws.onclose = () => {
      if (audioQueueRef.current.length === 0 && (!audioRef.current || audioRef.current.paused)) {
        setIsPlayingVoice(false);
      }
    };
  };

  const pollCourseTask = async (taskId: string) => {
    setIsCourseLoading(true);
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const res = await chatApi.getCourseTask(taskId);
        if (res.status === 'completed') {
          try {
            const parsed = JSON.parse(res.result);
            setCourseData(parsed);
          } catch (e) {
            console.error("Failed to parse course result:", e);
          }
          setIsCourseLoading(false);
          return true;
        } else if (res.status === 'failed') {
          setIsCourseLoading(false);
          return true;
        }
      } catch (e) {
        console.error("Polling error", e);
      }
      return false;
    };

    // Check immediately first
    const isDone = await checkStatus();
    if (isDone) return;

    // Otherwise poll every 2s
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        setIsCourseLoading(false);
        return;
      }
      const done = await checkStatus();
      if (done) clearInterval(interval);
    }, 2000);
  };

  const handleShowCourse = (taskId?: string) => {
    setShowCourse(true);
    if (taskId && (!courseData || isCourseLoading)) {
      pollCourseTask(taskId);
    }
  };

  return {
    showCourse,
    setShowCourse,
    courseData,
    isCourseLoading,
    isPlayingVoice,
    isVoiceLoading,
    handleVoiceExplain,
    handleShowCourse
  };
}
