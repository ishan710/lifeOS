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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'search' | 'sync'>('chat');
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



  const searchEmails = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:8000/api/emails/embeddings/search?query=${encodeURIComponent(searchQuery)}&user_id=${encodeURIComponent(userId)}&top_k=5`
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.results);
      } else {
        setError('Search failed');
      }
    } catch (err) {
      setError('Search error: ' + err);
    } finally {
      setLoading(false);
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
        alert(`✅ Successfully synced emails to database & search!\n\n📧 New emails processed: ${data.new_emails || 0}\n📊 Total emails found: ${data.total_emails || 0}\n💾 Stored in database: ${data.synced_to_supabase || 0}\n🔍 Indexed for AI search: ${data.synced_to_pinecone || 0}\n\n🎉 Your emails are now searchable with AI!`);
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

  const clearPineconeData = async () => {
    if (!window.confirm('⚠️ Are you sure you want to clear all your AI search data?\n\nThis will:\n• Delete all your email embeddings from the AI search index\n• Mark all emails as unprocessed\n• Require re-syncing to use AI search again\n\nThis action cannot be undone!')) {
      return;
    }

    setIsClearing(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:8000/api/emails/clear-embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Successfully cleared AI search data!\n\n🗑️ All your email embeddings have been removed from the search index.\n\n💡 You can now re-sync your emails to rebuild the search index.`);
        loadStats();
        loadSyncStats();
      } else {
        setError(data.error || 'Failed to clear AI search data');
      }
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
          max_context_items: 25
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
      <h2 style={{ marginBottom: '24px', color: '#1f1f1f' }}>🔍 Email RAG Search</h2>
      
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
          onClick={() => setActiveTab('search')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'search' ? '#1a73e8' : 'transparent',
            color: activeTab === 'search' ? 'white' : '#5f6368',
            border: 'none',
            borderBottom: activeTab === 'search' ? '2px solid #1a73e8' : 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '8px 8px 0 0'
          }}
        >
          🔍 Search
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

      {/* Actions Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          backgroundColor: '#e8f5e8',
          border: '1px solid #34a853',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          fontSize: '14px',
          color: '#137333'
        }}>
          ✨ <strong>Improved!</strong> Email indexing is now automatic when you sync emails. Use the <strong>Sync tab</strong> for the complete setup.
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('sync')}
            style={{
              padding: '12px 20px',
              backgroundColor: '#1a73e8',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🚀 Go to Sync & Setup
          </button>

          <button
            onClick={() => quickSync()}
            disabled={isSyncing}
            style={{
              padding: '12px 20px',
              backgroundColor: isSyncing ? '#ccc' : '#34a853',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isSyncing ? '⏳ Processing...' : '⚡ Quick Setup (20 emails)'}
          </button>
        </div>
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

            {/* Search Interface */}
      {activeTab === 'search' && (
        <>
          {/* Search Section */}
          <div style={{
            backgroundColor: '#fff',
            border: '1px solid #dadce0',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Search Your Emails</h3>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask about your emails... (e.g., 'emails about meetings', 'messages from John')"
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '1px solid #dadce0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onKeyPress={(e) => e.key === 'Enter' && searchEmails()}
                onFocus={(e) => e.target.style.borderColor = '#1a73e8'}
                onBlur={(e) => e.target.style.borderColor = '#dadce0'}
              />
              
              <button
                onClick={searchEmails}
                disabled={loading || !searchQuery.trim()}
                style={{
                  padding: '12px 24px',
                  backgroundColor: (!searchQuery.trim() || loading) ? '#ccc' : '#1a73e8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (!searchQuery.trim() || loading) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {loading ? '🔍 Searching...' : '🔍 Search'}
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#5f6368' }}>
              💡 Try: "emails about project deadlines", "messages from my manager", "flight confirmations"
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '24px',
              color: '#dc2626'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>
                🎯 Search Results ({searchResults.length})
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {searchResults.map((result, index) => (
                  <div
                    key={result.email_id}
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid #dadce0',
                      borderRadius: '8px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', color: '#1f1f1f' }}>
                        {result.subject || '(No Subject)'}
                      </h4>
                      <span style={{
                        backgroundColor: '#e8f0fe',
                        color: '#1565c0',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {Math.round(result.similarity_score * 100)}% match
                      </span>
                    </div>
                    
                    <div style={{ fontSize: '14px', color: '#5f6368', marginBottom: '8px' }}>
                      <strong>From:</strong> {result.from} | <strong>Date:</strong> {new Date(result.date).toLocaleDateString()}
                    </div>
                    
                    <p style={{ margin: '0', fontSize: '14px', color: '#202124', lineHeight: '1.4' }}>
                      {result.snippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {searchQuery && !loading && searchResults.length === 0 && !error && (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              color: '#5f6368',
              fontSize: '16px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤷‍♂️</div>
              <p>No emails found matching "{searchQuery}"</p>
              <p style={{ fontSize: '14px' }}>Try a different search term or index more emails first.</p>
            </div>
          )}
        </>
      )}

      {/* Sync Interface */}
      {activeTab === 'sync' && (
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #dadce0',
          borderRadius: '8px',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>🔄 Email Sync Dashboard</h3>
          
          {/* Sync Stats */}
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dadce0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>📊 Email Database & Search Status</h4>
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
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbc04' }}>
                      {syncStats.last_sync_date ? new Date(syncStats.last_sync_date).toLocaleDateString() : 'Never'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#5f6368' }}>📅 Last Sync</div>
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
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>🚀 Sync & Search Setup</h4>
            
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
                <strong>Clearing AI search data...</strong> Removing all email embeddings from search index
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
                  gap: '8px',
                  position: 'relative'
                }}
              >
                <span>⚡</span>
                {isSyncing ? 'Processing...' : 'Quick Setup'}
                <div style={{ 
                  fontSize: '11px', 
                  position: 'absolute', 
                  bottom: '4px', 
                  right: '8px',
                  opacity: 0.8
                }}>
                  20 emails
                </div>
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
                  gap: '8px',
                  position: 'relative'
                }}
              >
                <span>🔄</span>
                {isSyncing ? 'Processing...' : 'Complete Setup'}
                <div style={{ 
                  fontSize: '11px', 
                  position: 'absolute', 
                  bottom: '4px', 
                  right: '8px',
                  opacity: 0.8
                }}>
                  100 emails
                </div>
              </button>

              <button
                onClick={() => syncEmails(50, 10)}
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
                  gap: '8px',
                  position: 'relative'
                }}
              >
                <span>⚙️</span>
                {isSyncing ? 'Processing...' : 'Custom Setup'}
                <div style={{ 
                  fontSize: '11px', 
                  position: 'absolute', 
                  bottom: '4px', 
                  right: '8px',
                  opacity: 0.8
                }}>
                  50 emails
                </div>
              </button>
            </div>

            {/* Date Filtering Section */}
            <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  id="useDateFilter"
                  checked={useDateFilter}
                  onChange={(e) => setUseDateFilter(e.target.checked)}
                  style={{ margin: 0 }}
                />
                <label htmlFor="useDateFilter" style={{ fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                  📅 Filter emails by date range
                </label>
              </div>
              
              {useDateFilter && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#666' }}>Start Date (YYYY/MM/DD)</label>
                    <input
                      type="text"
                      placeholder="2024/01/01"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        width: '140px'
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#666' }}>End Date (YYYY/MM/DD)</label>
                    <input
                      type="text"
                      placeholder="2024/12/31"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '14px',
                        width: '140px'
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'end' }}>
                    <button
                      onClick={() => syncEmails(10000, 20)}
                      disabled={isSyncing || (!startDate && !endDate)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: (isSyncing || (!startDate && !endDate)) ? '#ccc' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (isSyncing || (!startDate && !endDate)) ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {isSyncing ? 'Syncing...' : 'Sync Date Range'}
                    </button>
                  </div>
                </div>
              )}
              
              {useDateFilter && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>
                  💡 <strong>Date Format:</strong> Use YYYY/MM/DD format (e.g., 2024/01/15). Leave one field empty to sync from/to that date only.
                  <br />
                  🎯 <strong>Sync Range:</strong> Will sync ALL emails within the specified date range (up to 10,000 emails).
                </div>
              )}
            </div>
          </div>

          {/* Clear Data Section */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>🗑️ Clear AI Search Data</h4>
            <div style={{
              backgroundColor: '#fff8e1',
              border: '1px solid #ffb74d',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>⚠️</span>
                <span style={{ fontWeight: '500', color: '#f57c00' }}>Caution: Data Clearing</span>
              </div>
              <div style={{ fontSize: '14px', color: '#e65100', lineHeight: '1.5' }}>
                This will remove all your email embeddings from the AI search index. You'll need to re-sync your emails to use AI search again.
              </div>
            </div>
            
            <button
              onClick={clearPineconeData}
              disabled={isClearing || isSyncing}
              style={{
                padding: '12px 20px',
                backgroundColor: isClearing ? '#ccc' : '#dc3545',
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
              {isClearing ? 'Clearing...' : 'Clear AI Search Data'}
            </button>
          </div>

          {/* Sync Info */}
          <div style={{
            backgroundColor: '#e8f0fe',
            border: '1px solid #dadce0',
            borderRadius: '8px',
            padding: '16px'
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>🚀 One-Step Email Sync</h4>
            <div style={{ 
              backgroundColor: '#ffffff', 
              border: '1px solid #1a73e8', 
              borderRadius: '6px', 
              padding: '12px', 
              marginBottom: '12px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#1a73e8'
            }}>
              ✨ <strong>NEW:</strong> Sync now automatically stores emails AND makes them AI-searchable in one step!
            </div>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px', lineHeight: '1.5' }}>
              <li><strong>Quick Sync:</strong> Process 20 most recent emails (fast, perfect for daily use)</li>
              <li><strong>Full Sync:</strong> Process up to 100 recent emails (comprehensive setup)</li>
              <li><strong>Custom Sync:</strong> Process 50 emails with optimized batching</li>
              <li><strong>🔄 Gmail → 💾 Database → 🤖 AI Search:</strong> All happens automatically</li>
              <li><strong>🔍 Instant Search:</strong> Emails are immediately searchable after sync</li>
              <li><strong>📝 No Duplicates:</strong> Only new emails are processed</li>
            </ul>
          </div>

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
      )}
    </div>
  );
};

export default EmailRAG; 