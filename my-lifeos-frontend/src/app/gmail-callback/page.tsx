"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GmailCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleGmailCallback = async () => {
      try {
        // Get the authorization code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state'); // This should be the user_id
        const error = urlParams.get('error');

        if (error) {
          console.error('Gmail OAuth error:', error);
          alert('Gmail connection failed: ' + error);
          window.close(); // Close popup window
          return;
        }

        if (!code) {
          console.error('No authorization code received for Gmail');
          alert('Gmail connection failed: No authorization code received');
          window.close();
          return;
        }

        // Call backend Gmail callback endpoint
        const response = await fetch(`http://localhost:8000/api/gmail-callback?code=${code}&state=${state}`, {
          method: 'GET',
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Gmail connected successfully:', result);
          
          // Notify parent window that Gmail was connected
          if (window.opener) {
            window.opener.postMessage({ type: 'gmail-connected', success: true }, '*');
          }
          
          alert('Gmail connected successfully!');
          window.close();
        } else {
          const errorText = await response.text();
          console.error('Gmail connection failed:', errorText);
          alert('Gmail connection failed: ' + errorText);
          window.close();
        }
        
      } catch (error) {
        console.error('Gmail callback error:', error);
        alert('Gmail connection failed. Please try again.');
        window.close();
      }
    };

    handleGmailCallback();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      fontFamily: '"Google Sans", "Roboto", Arial, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '40px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          📧
        </div>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: '400',
          color: '#1f1f1f'
        }}>
          Connecting Gmail...
        </h2>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: '#5f6368'
        }}>
          Please wait while we connect your Gmail account.
        </p>
      </div>
    </div>
  );
} 