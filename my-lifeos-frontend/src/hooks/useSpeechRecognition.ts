import { useState, useRef, useEffect, useCallback } from 'react';

// Type definitions for Speech Recognition API
interface SpeechRecognitionEvent {
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
      };
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

interface UseSpeechRecognitionReturn {
  isRecording: boolean;
  isPressed: boolean;
  status: string | null;
  isSupported: boolean;
  isHydrated: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseUp: (e: React.MouseEvent) => void;
  handleMouseLeave: (e: React.MouseEvent) => void;
  handleClick: (e: React.MouseEvent) => void;
}

export const useSpeechRecognition = (
  onTranscript: (transcript: string) => void
): UseSpeechRecognitionReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isSupported = isHydrated ? !!getSpeechRecognition() : false;

  const stopRecording = useCallback(() => {
    console.log("Stopping recording...");
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setIsPressed(false);
    setStatus("Recording stopped");
  }, []);

  const startRecording = useCallback(() => {
    console.log("Starting recording...");
    const SpeechRecognition = getSpeechRecognition();
    
    if (!SpeechRecognition) {
      setStatus("Speech recognition not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = true;
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        onTranscript(transcript);
        setStatus("Voice captured: " + transcript);
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log("Speech error:", event.error);
        let errorMessage = "Microphone error: " + event.error;
        if (event.error === "not-allowed" || event.error === "audio-capture") {
          errorMessage = "Please allow microphone access and try again.";
        }
        setStatus(errorMessage);
        stopRecording();
      };
      
      recognition.onstart = () => {
        console.log("Recording started successfully");
        setIsRecording(true);
        setStatus("🎤 Recording... Release to stop");
      };
      
      recognition.onend = () => {
        console.log("Recording ended");
        setIsRecording(false);
        setStatus("Recording stopped");
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      console.error("Error starting recording:", error);
      setStatus("Error starting recording");
    }
  }, [onTranscript, stopRecording]);

  // Button event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Mouse DOWN - starting recording");
    setIsPressed(true);
    if (!isRecording) {
      startRecording();
    }
  }, [isRecording, startRecording]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Mouse UP - stopping recording");
    setIsPressed(false);
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Mouse LEAVE - stopping recording");
    setIsPressed(false);
    if (isRecording) {
      stopRecording();
    }
  }, [isRecording, stopRecording]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    console.log("Click blocked - use hold only");
  }, []);

  // Keyboard handlers
  useEffect(() => {
    if (!isHydrated) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'n' && !e.repeat) {
        e.preventDefault();
        console.log("Shift+N DOWN - starting recording");
        if (!isRecording) {
          startRecording();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'Shift' || e.key.toLowerCase() === 'n') && isRecording) {
        e.preventDefault();
        console.log("Shift+N UP - stopping recording");
        stopRecording();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isHydrated, isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isPressed,
    status,
    isSupported,
    isHydrated,
    startRecording,
    stopRecording,
    handleMouseDown,
    handleMouseUp,
    handleMouseLeave,
    handleClick,
  };
}; 