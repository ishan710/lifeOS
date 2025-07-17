"use client";
import React, { useState, useRef } from "react";
import { addNote } from "../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/note/add";

const getSpeechRecognition = () => {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
};

const NoteInput: React.FC = () => {
  const [note, setNote] = useState("");
  const [userName, setUserName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
  };

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
  };

  const handleStartRecording = () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setStatus("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;
    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      setNote((prev) => prev + (prev ? " " : "") + transcript);
      setStatus("Voice captured.");
    };
    recognition.onerror = (event: any) => {
      setStatus("Voice recognition error: " + event.error);
      setIsRecording(false);
      isRecordingRef.current = false;
    };
    recognition.onend = () => {
      // If user hasn't stopped, restart
      if (isRecordingRef.current) {
        recognition.start();
      }
    };
    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    recognition.start();
    setIsRecording(true);
    setStatus("Listening...");
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setStatus("Stopped recording.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Processing note...");
    setCreatedTasks([]);
    
    try {
      const result = await addNote(note, userName);
      if (result.status === "success") {
        setStatus("Note processed successfully!");
        setNote("");
        if (result.created_tasks && result.created_tasks.length > 0) {
          setCreatedTasks(result.created_tasks);
          setStatus(`Note processed! Created tasks: ${result.created_tasks.join(", ")}`);
        } else {
          setStatus("Note processed! No tasks were created.");
        }
      } else {
        setStatus(result.message || "Error processing note.");
      }
    } catch (err) {
      setStatus("Error processing note.");
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "2rem auto", padding: 24, border: "1px solid #eee", borderRadius: 8 }}>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={userName}
          onChange={handleUserNameChange}
          placeholder="Your name (optional)"
          style={{ width: "100%", marginBottom: 8 }}
        />
        <textarea
          value={note}
          onChange={handleInputChange}
          rows={4}
          placeholder="Type or dictate your note..."
          style={{ width: "100%", marginBottom: 12 }}
        />
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {!isRecording ? (
            <button type="button" onClick={handleStartRecording}>
              🎤 Start Recording
            </button>
          ) : (
            <button type="button" onClick={handleStopRecording}>
              ⏹️ Stop Recording
            </button>
          )}
          <button type="submit" disabled={!note.trim()}>
            Submit
          </button>
        </div>
        {status && <div style={{ color: status.includes("error") ? "red" : "#333" }}>{status}</div>}
        {createdTasks.length > 0 && (
          <div style={{ marginTop: 12, padding: 8, backgroundColor: "#e8f5e8", borderRadius: 4 }}>
            <strong>Created tasks:</strong>
            <ul style={{ margin: "4px 0", paddingLeft: 20 }}>
              {createdTasks.map((task, index) => (
                <li key={index}>{task}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
};

export default NoteInput; 