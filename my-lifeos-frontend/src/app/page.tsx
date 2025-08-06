"use client";
import { useState, useEffect } from "react";
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
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <header style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        padding: '24px 0',
        marginBottom: '40px',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: '0 32px' }}>
          <h1 style={{ 
            textAlign: "center", 
            margin: 0,
            fontSize: '42px',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-1px',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>LifeOS</h1>
          <p style={{
            textAlign: 'center',
            margin: '8px 0 0 0',
            fontSize: '16px',
            color: '#6b7280',
            fontWeight: '400',
            letterSpacing: '0.5px'
          }}>AI-Powered Email Intelligence</p>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: '0 32px', position: 'relative', zIndex: 5 }}>
        {/* Authentication Section */}
        {user ? (
        <div style={{ 
          textAlign: "center", 
          marginBottom: 40,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative elements */}
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            borderRadius: '50%',
            filter: 'blur(20px)'
          }} />
          
          <div style={{ marginBottom: 20, position: 'relative' }}>
              <div style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                Welcome back, {user.name}! 👋
              </div>
              <div style={{ 
                fontSize: 15, 
                color: '#6b7280',
                fontWeight: '500',
                letterSpacing: '0.3px'
              }}>
                {user.email}
              </div>
          </div>
          
            <button
              onClick={handleLogout}
                style={{ 
                padding: "12px 24px",
                backgroundColor: "rgba(239, 68, 68, 0.9)",
                color: "white",
                border: "none",
                borderRadius: '12px',
                cursor: "pointer",
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                letterSpacing: '0.5px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                }}
            >
              Sign Out
            </button>
            </div>
        ) : (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            textAlign: 'center'
          }}>
            <GoogleLogin onLogin={handleLogin} />
          </div>
          )}

        {/* App Content - Only show when user is logged in */}
        {user && (
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            overflow: 'hidden',
            minHeight: '500px',
            position: 'relative'
          }}>
            {/* Decorative corner element */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 0,
              height: 0,
              borderStyle: 'solid',
              borderWidth: '0 60px 60px 0',
              borderColor: 'transparent rgba(102, 126, 234, 0.1) transparent transparent',
              zIndex: 1
            }} />
            
            {/* AI Search content */}
            <div style={{ position: 'relative', zIndex: 2 }}>
              {userId ? (
                <EmailRAG userId={userId} />
              ) : (
                <div style={{ 
                  textAlign: "center", 
                  padding: 80,
                  color: '#6b7280',
                  fontSize: '18px'
                }}>
                  <div style={{ 
                    fontSize: '64px', 
                    marginBottom: '24px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>🔍</div>
                  <p style={{ 
                    margin: '0 0 16px 0',
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>AI Email Search</p>
                  <p style={{ 
                    margin: 0,
                    fontSize: '16px',
                    color: '#6b7280',
                    lineHeight: '1.6'
                  }}>Please sign in to access intelligent email search and analysis.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}