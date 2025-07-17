"use client";
import React, { useState } from "react";
import { addNote } from "../lib/api";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import RecordButton from "./RecordButton";
import StatusMessage from "./StatusMessage";
import TaskList from "./TaskList";
import styles from "./NoteInput.module.css";

const NoteInput: React.FC = () => {
  const [note, setNote] = useState("");
  const [userName, setUserName] = useState("");
  const [createdTasks, setCreatedTasks] = useState<string[]>([]);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);

  // Handle transcript from speech recognition
  const handleTranscript = (transcript: string) => {
    setNote((prev) => prev + (prev ? " " : "") + transcript);
  };

  // Use speech recognition hook
  const speechRecognition = useSpeechRecognition(handleTranscript);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNote(e.target.value);
  };

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("Processing note...");
    setCreatedTasks([]);
    
    try {
      const result = await addNote(note, userName);
      if (result.status === "success") {
        setSubmitStatus("Note processed successfully!");
        setNote("");
        if (result.created_tasks && result.created_tasks.length > 0) {
          setCreatedTasks(result.created_tasks);
          setSubmitStatus(`Note processed! Created tasks: ${result.created_tasks.join(", ")}`);
        } else {
          setSubmitStatus("Note processed! No tasks were created.");
        }
      } else {
        setSubmitStatus(result.message || "Error processing note.");
      }
    } catch (error) {
      console.error("Error processing note:", error);
      setSubmitStatus("Error processing note.");
    }
  };

  const isSubmitDisabled = !note.trim();
  const isRecordingError = speechRecognition.status?.includes("error") || 
                          speechRecognition.status?.includes("Microphone") ||
                          speechRecognition.status?.includes("denied");

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={userName}
          onChange={handleUserNameChange}
          placeholder="Your name (optional)"
          className={styles.input}
        />
        
        <textarea
          value={note}
          onChange={handleInputChange}
          rows={4}
          placeholder="Type or dictate your note..."
          className={styles.textarea}
        />
        
        <div className={styles.controls}>
          {speechRecognition.isHydrated ? (
            <RecordButton
              isRecording={speechRecognition.isRecording}
              isPressed={speechRecognition.isPressed}
              disabled={!speechRecognition.isSupported}
              onMouseDown={speechRecognition.handleMouseDown}
              onMouseUp={speechRecognition.handleMouseUp}
              onMouseLeave={speechRecognition.handleMouseLeave}
              onClick={speechRecognition.handleClick}
            />
          ) : (
            <div className={`${styles.recordButton} ${styles.placeholder}`}>
              <div className={styles.recordDot} />
              🎤 Hold to Record
            </div>
          )}
          
          <span className={styles.helpText}>
            Hold button down to record
          </span>
          
          <span className={styles.helpText}>
            or hold Shift + N
          </span>
          
          <button 
            type="submit" 
            disabled={isSubmitDisabled}
            className={`${styles.submitButton} ${isSubmitDisabled ? styles.disabled : styles.enabled}`}
          >
            Submit
          </button>
        </div>
        
        {speechRecognition.status && (
          <StatusMessage 
            message={speechRecognition.status} 
            isError={isRecordingError}
          />
        )}
        
        {submitStatus && (
          <StatusMessage 
            message={submitStatus} 
            isError={submitStatus.includes("error")}
          />
        )}
        
        <TaskList tasks={createdTasks} />
      </form>
    </div>
  );
};

export default NoteInput; 