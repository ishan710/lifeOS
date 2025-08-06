"use client";
import React, { useState, useEffect } from 'react';

interface EmailRAGProps {
  userId: string;
}

interface SearchResult {
  email_id: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  similarity_score: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  context?: any[];
}

interface EmbeddingStats {
  total_emails: number;
  user_id: string;
  index_name: string;
}

const EmailRAG: React.FC<EmailRAGProps> = ({ userId }) => {
  // Add CSS for spinner animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'sync'>('chat');
  const [syncStats, setSyncStats] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  // Date filtering state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [useDateFilter, setUseDateFilter] = useState(false);

  useEffect(() => {
    if (userId && userId !== "anonymous") {
      loadStats();
      loadSyncStats();
    }
  }, [userId]);

  const loadStats = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/emails/embeddings/stats?user_id=${encodeURIComponent(userId)}`);
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to load embedding stats:', err);
    }
  };

  const loadSyncStats = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/emails/sync/stats?user_id=${encodeURIComponent(userId)}`);
      const data = await response.json();
      setSyncStats(data);
    } catch (err) {
      console.error('Failed to load sync stats:', err);
    }
  };

  const syncEmails = async (maxEmails: number = 50, batchSize: number = 10) => {
    setIsSyncing(true);
    setError(null);

    try {
      const requestBody: any = {
        user_id: userId,
        max_emails: maxEmails,
        batch_size: batchSize
      };

      // Add date filtering if enabled
      if (useDateFilter) {
        if (startDate) requestBody.start_date = startDate;
        if (endDate) requestBody.end_date = endDate;
      }

      const response = await fetch(`http://localhost:8000/api/emails/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Successfully synced emails!\n\n📧 New emails processed: ${data.message}`);
        loadStats();
        loadSyncStats();
      } else {
        setError(data.error || 'Sync failed');
      }
    } catch (err) {
      setError('Sync error: ' + err);
    } finally {
      setIsSyncing(false);
    }
  };

  const quickSync = async () => {
    await syncEmails(20, 5); // Quick sync with 20 emails, batch size 5
  };

  const fullSync = async () => {
    await syncEmails(100, 10); // Full sync with 100 emails, batch size 10
  };

  const bulkSync = async () => {
    await syncEmails(1000, 20); // Bulk sync with 1000 emails, batch size 20
  };

  const clearAllData = async () => {
    if (!window.confirm('⚠️ Are you sure you want to clear all your email data?\n\nThis will:\n• Delete all your email embeddings from Pinecone\n• Delete all your emails from Supabase\n• Remove all AI search capabilities\n\nThis action cannot be undone!')) {
      return;
    }

    setIsClearing(true);
    setError(null);

    try {
      // Clear Pinecone embeddings
      const pineconeResponse = await fetch(`http://localhost:8000/api/emails/clear-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const pineconeData = await pineconeResponse.json();
      
      if (!pineconeData.success) {
        throw new Error(`Failed to clear Pinecone data: ${pineconeData.error || 'Unknown error'}`);
      }

      // Clear Supabase emails
      const supabaseResponse = await fetch(`http://localhost:8000/api/emails/clear-supabase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ user_id: userId })
      });
      
      const supabaseData = await supabaseResponse.json();
      
      if (!supabaseData.success) {
        throw new Error(`Failed to clear Supabase data: ${supabaseData.error || 'Unknown error'}`);
      }

      alert(`✅ Successfully cleared all email data!\n\n🗑️ All your emails have been removed from both Pinecone and Supabase.\n\n💡 You can now re-sync your emails to rebuild the data.`);
      loadStats();
      loadSyncStats();
    } catch (err) {
      setError('Clear error: ' + err);
    } finally {
      setIsClearing(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput.trim(),
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          question: userMessage.content,
          content_type: 'email',
          max_context_items: 5,
          max_tokens_per_item: 200,
          truncate_context: true
        })
      });

      const data = await response.json();

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.success ? data.answer : `Error: ${data.answer}`,
        timestamp: new Date(),
        context: data.context_items || []
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Sorry, I encountered an error: ${err}`,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', fontFamily: '"Google Sans", "Roboto", Arial, sans-serif' }}>
      <h2 style={{ marginBottom: '24px', color: '#1f1f1f' }}>🔍 Email AI Assistant</h2>
      
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #dadce0', 
        marginBottom: '24px' 
      }}>
        <button
          onClick={() => setActiveTab('chat')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'chat' ? '#1a73e8' : 'transparent',
            color: activeTab === 'chat' ? 'white' : '#5f6368',
            border: 'none',
            borderBottom: activeTab === 'chat' ? '2px solid #1a73e8' : 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '8px 8px 0 0'
          }}
        >
          💬 Chat
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'sync' ? '#1a73e8' : 'transparent',
            color: activeTab === 'sync' ? 'white' : '#5f6368',
            border: 'none',
            borderBottom: activeTab === 'sync' ? '2px solid #1a73e8' : 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '8px 8px 0 0'
          }}
        >
          🔄 Sync
        </button>
      </div>
      
      {/* Stats Section */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        border: '1px solid #dadce0',
        borderRadius: '8px', 
        padding: '16px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>🤖 AI Search Status</h3>
        {stats ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🔍</span>
              <span><strong>{stats.total_emails}</strong> emails ready for AI search</span>
            </div>
            <div style={{ 
              fontSize: '12px',
              color: '#5f6368',
              backgroundColor: '#e8f0fe',
              padding: '6px 8px',
              borderRadius: '4px',
              display: 'inline-block'
            }}>
              Vector Index: {stats.index_name}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⏳</span>
            <span>Loading search index status...</span>
          </div>
        )}
      </div>

      {/* Chat Interface */}
      {activeTab === 'chat' && (
        <div style={{ 
          backgroundColor: '#fff',
          border: '1px solid #dadce0', 
          borderRadius: '8px',
          height: '500px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Chat Messages */}
          <div style={{ 
            flex: 1,
            overflowY: 'auto', 
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {chatMessages.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#5f6368', 
                marginTop: '100px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
                <h3 style={{ margin: '0 0 8px 0' }}>Start a conversation</h3>
                <p style={{ margin: '0', fontSize: '14px' }}>
                  Ask me anything about your emails!
                </p>
              </div>
            ) : (
              chatMessages.map((message) => (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '18px',
                    backgroundColor: message.type === 'user' ? '#1a73e8' : '#f1f3f4',
                    color: message.type === 'user' ? 'white' : '#202124',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    wordWrap: 'break-word'
                  }}>
                    {message.content}
                    {message.context && message.context.length > 0 && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: message.type === 'user' ? 'rgba(255,255,255,0.1)' : '#e8f0fe',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}>
                        <strong>Based on {message.context.length} relevant emails</strong>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            
            {isChatLoading && (
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: '8px'
              }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '18px',
                  backgroundColor: '#f1f3f4',
                  color: '#202124',
                  fontSize: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #dadce0',
                      borderTop: '2px solid #1a73e8',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Thinking...
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div style={{ 
            borderTop: '1px solid #dadce0',
            padding: '16px', 
            backgroundColor: '#f8f9fa'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about your emails... (e.g., 'What meetings do I have this week?')"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '1px solid #dadce0',
                  borderRadius: '24px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                disabled={isChatLoading}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || isChatLoading}
                style={{
                  padding: '12px 16px',
                  backgroundColor: (!chatInput.trim() || isChatLoading) ? '#ccc' : '#1a73e8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: (!chatInput.trim() || isChatLoading) ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ➤
              </button>
            </div>
            <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '8px' }}>
              💡 Try: "What meetings do I have this week?", "Show me emails from my manager", "Find flight confirmations"
            </div>
          </div>
        </div>
      )}

      {/* Sync Interface */}
      {activeTab === 'sync' && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #dadce0',
          borderRadius: '8px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>🔄 Email Sync</h3>
          
          {/* Sync Stats */}
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dadce0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>📊 Email Status</h4>
            {syncStats ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1a73e8' }}>
                      {syncStats.total_emails_count || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#5f6368' }}>📧 Total Emails</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#34a853' }}>
                      {(syncStats.total_emails_count || 0) - (syncStats.unprocessed_emails_count || 0)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#5f6368' }}>🔍 AI-Searchable</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: syncStats.unprocessed_emails_count > 0 ? '#ea4335' : '#34a853' }}>
                      {syncStats.unprocessed_emails_count || 0}
                    </div>
                    <div style={{ fontSize: '12px', color: '#5f6368' }}>⏳ Pending</div>
                  </div>
                </div>
                
                {syncStats.unprocessed_emails_count === 0 && syncStats.total_emails_count > 0 && (
                  <div style={{
                    backgroundColor: '#e8f5e8',
                    border: '1px solid #34a853',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    color: '#137333',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    ✅ <strong>All emails are synced and AI-searchable!</strong>
                  </div>
                )}
                
                {syncStats.unprocessed_emails_count > 0 && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #f87171',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    ⚠️ <strong>{syncStats.unprocessed_emails_count} emails</strong> need to be processed for AI search
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⏳</span>
                <span>Loading sync status...</span>
              </div>
            )}
          </div>

          {/* Sync Actions */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>🚀 Sync Emails</h4>
            
            {isSyncing && (
              <div style={{
                backgroundColor: '#e8f0fe',
                border: '1px solid #1a73e8',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '14px',
                color: '#1a73e8',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #1a73e8',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <strong>Processing emails...</strong> Syncing to database and making them AI-searchable
              </div>
            )}

            {isClearing && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #dc3545',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '14px',
                color: '#dc3545',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #dc3545',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <strong>Clearing all data...</strong> Removing emails from Pinecone and Supabase
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => quickSync()}
                disabled={isSyncing}
                style={{
                  padding: '16px 24px',
                  backgroundColor: isSyncing ? '#ccc' : '#34a853',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>⚡</span>
                {isSyncing ? 'Processing...' : 'Quick Sync (20 emails)'}
              </button>

              <button
                onClick={() => fullSync()}
                disabled={isSyncing}
                style={{
                  padding: '16px 24px',
                  backgroundColor: isSyncing ? '#ccc' : '#1a73e8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>🔄</span>
                {isSyncing ? 'Processing...' : 'Full Sync (100 emails)'}
              </button>

              <button
                onClick={() => bulkSync()}
                disabled={isSyncing}
                style={{
                  padding: '16px 24px',
                  backgroundColor: isSyncing ? '#ccc' : '#fbbc04',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>🚀</span>
                {isSyncing ? 'Processing...' : 'Bulk Sync (1000 emails)'}
              </button>
            </div>

            {/* Clear Data Section */}
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fff8e1', borderRadius: '8px', border: '1px solid #ffb74d' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#f57c00' }}>🗑️ Clear All Data</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#e65100', lineHeight: '1.5' }}>
                This will permanently delete all your emails from both Pinecone (AI search) and Supabase (database).
              </p>
              <button
                onClick={clearAllData}
                disabled={isClearing || isSyncing}
                style={{
                  padding: '12px 20px',
                  backgroundColor: (isClearing || isSyncing) ? '#ccc' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (isClearing || isSyncing) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>🗑️</span>
                {isClearing ? 'Clearing...' : 'Clear All Email Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #f87171',
          borderRadius: '8px',
          padding: '12px',
          marginTop: '16px',
          color: '#dc2626'
        }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default EmailRAG; 