"use client";
import { useState, useEffect } from "react";
import NoteInput from "../components/NoteInput";
import TaskDashboard from "../components/TaskDashboard";
import IdeaList from "../components/IdeaList";
import EmailViewer from "../components/EmailViewer";
import GoogleLogin from "../components/GoogleLogin";
import EmailRAG from "../components/EmailRAG";

interface User {
  id: string;
  email: string;
  name: string;
  user_name: string;
  created_at: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"input" | "tasks" | "ideas" | "gmail" | "search">("input");
  const [user, setUser] = useState<User | null>(null);

  // Load saved user on component mount
  useEffect(() => {
    // Load saved user
    const savedUser = localStorage.getItem("lifeos-user");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
      } catch (error) {
        console.error("Failed to parse saved user:", error);
        localStorage.removeItem("lifeos-user");
      }
    }
  }, []);



  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("lifeos-user");
  };

  const effectiveUserName = user?.name || "";
  const userId = user?.email || "anonymous";

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      fontFamily: '"Google Sans", "Roboto", Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        padding: '16px 0',
        marginBottom: '24px'
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: '0 24px' }}>
          <h1 style={{ 
            textAlign: "center", 
            margin: 0,
            fontSize: '32px',
            fontWeight: '400',
            color: '#1f1f1f',
            letterSpacing: '-0.5px'
          }}>LifeOS</h1>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: '0 24px' }}>
        {/* Authentication Section */}
        {user ? (
        <div style={{ 
          textAlign: "center", 
          marginBottom: 32,
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
        }}>
          <div style={{ marginBottom: 16 }}>
              <strong>Welcome, {user.name}!</strong>
              <div style={{ fontSize: 14, color: '#5f6368' }}>{user.email}</div>
          </div>
          
            <button
              onClick={handleLogout}
                style={{ 
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: '6px',
                cursor: "pointer",
                fontSize: '14px',
                fontWeight: '500'
                }}
            >
              Sign Out
            </button>
            </div>
        ) : (
          <GoogleLogin onLogin={handleLogin} />
          )}

        {/* App Content - Only show when user is logged in */}
        {user && (
          <>
        {/* Tab navigation */}
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          marginBottom: 32,
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          width: 'fit-content',
          margin: '0 auto 32px auto'
        }}>
          <button
            onClick={() => setActiveTab("input")}
            style={{
              padding: "12px 24px",
              margin: "0 4px",
              border: "none",
              borderRadius: '8px',
              backgroundColor: activeTab === "input" ? "#1a73e8" : "transparent",
              color: activeTab === "input" ? "white" : "#5f6368",
              cursor: "pointer",
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              minWidth: '100px'
            }}
          >
            Add Note
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            style={{
              padding: "12px 24px",
              margin: "0 4px",
              border: "none",
              borderRadius: '8px',
              backgroundColor: activeTab === "tasks" ? "#1a73e8" : "transparent",
              color: activeTab === "tasks" ? "white" : "#5f6368",
              cursor: "pointer",
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              minWidth: '100px'
            }}
          >
            View Tasks
          </button>
          <button
            onClick={() => setActiveTab("ideas")}
            style={{
              padding: "12px 24px",
              margin: "0 4px",
              border: "none",
              borderRadius: '8px',
              backgroundColor: activeTab === "ideas" ? "#1a73e8" : "transparent",
              color: activeTab === "ideas" ? "white" : "#5f6368",
              cursor: "pointer",
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              minWidth: '100px'
            }}
          >
            View Ideas
          </button>
          <button
            onClick={() => setActiveTab("gmail")}
            style={{
              padding: "12px 24px",
              margin: "0 4px",
              border: "none",
              borderRadius: '8px',
              backgroundColor: activeTab === "gmail" ? "#1a73e8" : "transparent",
              color: activeTab === "gmail" ? "white" : "#5f6368",
              cursor: "pointer",
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              minWidth: '100px'
            }}
          >
            📧 Gmail
          </button>
          <button
            onClick={() => setActiveTab("search")}
            style={{
              padding: "12px 24px",
              margin: "0 4px",
              border: "none",
              borderRadius: '8px',
              backgroundColor: activeTab === "search" ? "#1a73e8" : "transparent",
              color: activeTab === "search" ? "white" : "#5f6368",
              cursor: "pointer",
              fontFamily: 'inherit',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s',
              minWidth: '100px'
            }}
          >
            🔍 AI Search
          </button>
        </div>

        {/* Tab content */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          overflow: 'hidden',
          minHeight: '400px'
        }}>
          {activeTab === "input" ? (
            <NoteInput />
          ) : activeTab === "tasks" ? (
            effectiveUserName ? (
              <TaskDashboard userName={effectiveUserName} />
            ) : (
              <div style={{ 
                textAlign: "center", 
                padding: 48,
                color: '#5f6368',
                fontSize: '16px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
                <p>Please enter your name above to view tasks.</p>
              </div>
            )
          ) : activeTab === "ideas" ? (
            effectiveUserName ? (
              <IdeaList userName={effectiveUserName} />
            ) : (
              <div style={{ 
                textAlign: "center", 
                padding: 48,
                color: '#5f6368',
                fontSize: '16px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💡</div>
                <p>Please enter your name above to view ideas.</p>
              </div>
            )
          ) : activeTab === "gmail" ? (
            // Gmail tab
            userId ? (
              <EmailViewer userId={userId} />
            ) : (
              <div style={{ 
                textAlign: "center", 
                padding: 48,
                color: '#5f6368',
                fontSize: '16px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
                <p>Please enter your name above to use Gmail integration.</p>
              </div>
            )
          ) : (
            // AI Search tab
            userId ? (
              <EmailRAG userId={userId} />
            ) : (
              <div style={{ 
                textAlign: "center", 
                padding: 48,
                color: '#5f6368',
                fontSize: '16px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                <p>Please sign in to use AI email search.</p>
              </div>
            )
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}