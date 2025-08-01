"use client";
import React, { useState } from 'react';

const SimpleGmail: React.FC = () => {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const connectGmail = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/simple-gmail/auth');
      const data = await response.json();
      
      if (data.auth_url) {
        // Open Google OAuth in new window
        window.open(data.auth_url, 'gmail-auth', 'width=500,height=600');
        
        // Listen for the callback
        window.addEventListener('message', (event) => {
          if (event.data === 'gmail-connected') {
            setConnected(true);
            loadEmails();
          }
        });
      }
    } catch (error) {
      console.error('Error connecting Gmail:', error);
    }
  };

  const loadEmails = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/simple-gmail/emails');
      const data = await response.json();
      
      if (data.emails) {
        setEmails(data.emails);
        setConnected(true);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <h2>📧 Simple Gmail - MVP</h2>
      
      {!connected ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <button
            onClick={connectGmail}
            style={{
              padding: '15px 30px',
              fontSize: 18,
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            🔗 Connect Gmail
          </button>
          <p style={{ marginTop: 20, color: '#666' }}>
            Click to connect your Gmail and see your top 3 emails
          </p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3>✅ Gmail Connected - Top 3 Emails</h3>
            <button
              onClick={loadEmails}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#34a853',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {emails.length === 0 ? (
            <p>No emails found.</p>
          ) : (
            <div>
              {emails.map((email, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  <h4 style={{ margin: '0 0 8px 0', color: '#1a73e8' }}>
                    {email.subject}
                  </h4>
                  <p style={{ margin: '4px 0', fontSize: 14, color: '#666' }}>
                    <strong>From:</strong> {email.from}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: 12, color: '#999' }}>
                    <strong>Date:</strong> {email.date}
                  </p>
                  <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#333' }}>
                    {email.snippet}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleGmail; 