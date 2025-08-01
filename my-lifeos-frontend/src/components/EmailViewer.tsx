"use client";
import React, { useState, useEffect } from 'react';

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  snippet: string;
  label_ids: string[];
}

interface EmailViewerProps {
  userId: string;
}

const EmailViewer: React.FC<EmailViewerProps> = ({ userId }) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Gmail is now automatically connected when user signs in with Google
  // No separate connection needed

  // Auto-load emails when component mounts
  useEffect(() => {
    if (userId && userId !== "anonymous") {
      console.log('🔧 DEBUG: Auto-loading emails for userId:', userId);
      loadLatestEmails();
    }
  }, [userId]);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8000/api/gmail/test-connection?user_id=${encodeURIComponent(userId)}`);
      const data = await response.json();
      
      if (data.connected) {
        setEmails(data.latest_emails || []);
        console.log('Gmail connection test:', data);
      } else {
        setError(data.error || 'Failed to connect to Gmail');
      }
    } catch (err) {
      setError('Network error: ' + err);
      console.error('Test connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmailCount = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/gmail/email-count?user_id=${encodeURIComponent(userId)}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setStats(data);
        setEmails(data.latest_emails || []);
      }
    } catch (err) {
      setError('Failed to load email count: ' + err);
    }
  };

  const loadLatestEmails = async (maxResults: number = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/gmail/emails?user_id=${encodeURIComponent(userId)}&query=&max_results=${maxResults}`
      );
      const data = await response.json();
      
      if (data.emails) {
        setEmails(data.emails);
      } else {
        setError('No emails returned');
      }
    } catch (err) {
      setError('Failed to load emails: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadEmails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/gmail/emails?user_id=${encodeURIComponent(userId)}&query=is:unread&max_results=10`
      );
      const data = await response.json();
      
      if (data.emails) {
        setEmails(data.emails);
      } else {
        setError('No unread emails found');
      }
    } catch (err) {
      setError('Failed to load unread emails: ' + err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const extractSenderName = (fromField: string) => {
    const match = fromField.match(/^(.*?)\s*<.*>$/);
    return match ? match[1].replace(/['"]/g, '') : fromField;
  };

  return (
    <div style={{ 
      maxWidth: 800, 
      margin: '20px auto', 
      padding: 24,
      backgroundColor: '#fff',
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
    }}>
      <h2 style={{ 
        color: '#1f1f1f', 
        marginBottom: 24,
        fontSize: 24,
        fontWeight: 500 
      }}>
        📧 Gmail Integration
      </h2>

      {/* Control Buttons */}
      <div style={{ 
        display: 'flex', 
        gap: 12, 
        marginBottom: 24,
        flexWrap: 'wrap'
      }}>
        <div style={{
          padding: '10px 16px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
          textAlign: 'center'
        }}>
          ✅ Gmail Connected Automatically
        </div>
        
        <button
          onClick={testConnection}
          disabled={loading}
          style={{
            padding: '10px 16px',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Test Connection
        </button>
        
        <button
          onClick={loadEmailCount}
          disabled={loading}
          style={{
            padding: '10px 16px',
            backgroundColor: '#34a853',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Get Email Stats
        </button>
        
        <button
          onClick={() => loadLatestEmails(10)}
          disabled={loading}
          style={{
            padding: '10px 16px',
            backgroundColor: '#ea4335',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Load Latest 10
        </button>
        
        <button
          onClick={loadUnreadEmails}
          disabled={loading}
          style={{
            padding: '10px 16px',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 500
          }}
        >
          Load Unread
        </button>
      </div>

      {/* Stats Display */}
      {stats && (
        <div style={{
          padding: 16,
          backgroundColor: '#f8f9fa',
          borderRadius: 8,
          marginBottom: 24,
          border: '1px solid #e0e0e0'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#1f1f1f' }}>Email Statistics</h3>
          <p style={{ margin: 0, fontSize: 14, color: '#5f6368' }}>
            Recent emails: {stats.recent_emails_count} | Unread: {stats.unread_count}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ 
          textAlign: 'center', 
          padding: 40,
          color: '#5f6368',
          fontSize: 16
        }}>
          Loading emails...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div style={{
          padding: 16,
          backgroundColor: '#fce8e6',
          color: '#d93025',
          borderRadius: 8,
          marginBottom: 16,
          border: '1px solid #ea4335'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Emails List */}
      {emails.length > 0 && !loading && (
        <div>
          <h3 style={{ 
            marginBottom: 16, 
            fontSize: 18, 
            color: '#1f1f1f',
            fontWeight: 500 
          }}>
            Latest Emails ({emails.length})
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {emails.map((email) => (
              <div
                key={email.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: 8,
                  padding: 16,
                  backgroundColor: '#fff',
                  transition: 'box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: 8
                }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: 16, 
                      color: '#1f1f1f',
                      fontWeight: 500,
                      lineHeight: 1.3
                    }}>
                      {email.subject || '(No Subject)'}
                    </h4>
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: 14, 
                      color: '#5f6368',
                      fontWeight: 500
                    }}>
                      From: {extractSenderName(email.from)}
                    </p>
                  </div>
                  <span style={{ 
                    fontSize: 12, 
                    color: '#5f6368',
                    whiteSpace: 'nowrap',
                    marginLeft: 16
                  }}>
                    {formatDate(email.date)}
                  </span>
                </div>
                
                <p style={{ 
                  margin: '8px 0 0 0', 
                  fontSize: 14, 
                  color: '#5f6368',
                  lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {email.snippet}
                </p>
                
                {email.label_ids && email.label_ids.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {email.label_ids.filter(label => !label.startsWith('Label_')).map((label) => (
                      <span
                        key={label}
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          backgroundColor: '#e8f0fe',
                          color: '#1a73e8',
                          borderRadius: 12,
                          fontSize: 11,
                          marginRight: 4,
                          textTransform: 'uppercase'
                        }}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {emails.length === 0 && !loading && !error && (
        <div style={{ 
          textAlign: 'center', 
          padding: 40,
          color: '#5f6368',
          fontSize: 16
        }}>
          No emails to display. Click "Test Connection" to get started.
        </div>
      )}
    </div>
  );
};

export default EmailViewer; 