"use client";
import { useState } from "react";
import NoteInput from "../components/NoteInput";
import TaskDashboard from "../components/TaskDashboard";
import IdeaList from "../components/IdeaList";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"input" | "tasks" | "ideas">("input");
  const [userName, setUserName] = useState("");

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <h1 style={{ textAlign: "center", marginBottom: 32 }}>LifeOS</h1>
      
      {/* User name input */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your name to get started"
          style={{ 
            padding: "8px 16px", 
            fontSize: 16, 
            border: "1px solid #ddd", 
            borderRadius: 4,
            width: 300
          }}
        />
      </div>

      {/* Tab navigation */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("input")}
          style={{
            padding: "12px 24px",
            margin: "0 8px",
            border: "none",
            borderRadius: 4,
            backgroundColor: activeTab === "input" ? "#007bff" : "#f8f9fa",
            color: activeTab === "input" ? "white" : "#333",
            cursor: "pointer",
          }}
        >
          Add Note
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          style={{
            padding: "12px 24px",
            margin: "0 8px",
            border: "none",
            borderRadius: 4,
            backgroundColor: activeTab === "tasks" ? "#007bff" : "#f8f9fa",
            color: activeTab === "tasks" ? "white" : "#333",
            cursor: "pointer",
          }}
        >
          View Tasks
        </button>
        <button
          onClick={() => setActiveTab("ideas")}
          style={{
            padding: "12px 24px",
            margin: "0 8px",
            border: "none",
            borderRadius: 4,
            backgroundColor: activeTab === "ideas" ? "#007bff" : "#f8f9fa",
            color: activeTab === "ideas" ? "white" : "#333",
            cursor: "pointer",
          }}
        >
          View Ideas
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "input" ? (
        <NoteInput />
      ) : activeTab === "tasks" ? (
        userName ? (
          <TaskDashboard userName={userName} />
        ) : (
          <div style={{ textAlign: "center", padding: 48 }}>
            <p>Please enter your name above to view tasks.</p>
          </div>
        )
      ) : (
        userName ? (
          <IdeaList userName={userName} />
        ) : (
          <div style={{ textAlign: "center", padding: 48 }}>
            <p>Please enter your name above to view ideas.</p>
          </div>
        )
      )}
    </div>
  );
}