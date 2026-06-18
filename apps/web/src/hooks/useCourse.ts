import { useState, useRef } from 'react';
import { chatApi } from '../api/chat';
import { TTS_WS_URL } from '../constants';

export function useCourse() {
  const [showCourse, setShowCourse] = useState(false);
  const [courseData, setCourseData] = useState<any>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [courseMode, setCourseMode] = useState<'edit' | 'view'>('edit');
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
    
    const ws = new WebSocket(TTS_WS_URL);
    ws.binaryType = 'blob';
    wsRef.current = ws;

    ws.onopen = () => {
      setIsVoiceLoading(false);
      setIsPlayingVoice(true);
      
      // Simply clean up Markdown string to read
      let textToRead = typeof courseData === 'string' ? courseData : '';
      if (!textToRead) return;
      
      // Strip markdown images
      textToRead = textToRead.replace(/!\[.*?\]\(.*?\)/g, '');
      // Strip heading hashes but keep text
      textToRead = textToRead.replace(/^(#{1,6})\s+/gm, '');
      // Strip markdown list bullets and asterisks
      textToRead = textToRead.replace(/^[\*\-]\s+/gm, '');
      textToRead = textToRead.replace(/\*\*/g, '');
      
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
            setCourseData(res.result); // Directly set the Markdown string
          } catch (e) {
            console.error("Failed to set course result:", e);
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

  const handleShowCourse = (taskId?: string, mode: 'edit' | 'view' = 'edit') => {
    setShowCourse(true);
    setCourseMode(mode);
    if (taskId && taskId !== currentTaskId) {
      setCurrentTaskId(taskId);
      setCourseData(null); // Clear previous course data
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
    handleShowCourse,
    currentTaskId,
    courseMode
  };
}
