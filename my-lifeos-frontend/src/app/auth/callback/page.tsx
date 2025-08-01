"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          console.error('OAuth error:', error);
          alert('Login failed: ' + error);
          router.push('/');
          return;
        }

        if (!code) {
          console.error('No authorization code received');
          alert('Login failed: No authorization code received');
          router.push('/');
          return;
        }

        // Exchange the authorization code for user data via backend
        const response = await fetch('http://localhost:8000/api/auth/google/exchange-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Token exchange failed:', errorData);
          alert('Authentication failed: ' + errorData);
          router.push('/');
          return;
        }

        const result = await response.json();
        
        if (result.success && result.user) {
          // Store the REAL user data from Google
          localStorage.setItem('lifeos-user', JSON.stringify(result.user));
          
          // Redirect to main app
          router.push('/');
          
          console.log('User authenticated:', result.user.email);
        } else {
          throw new Error(result.message || 'Authentication failed');
        }
        
      } catch (error) {
        console.error('Callback error:', error);
        alert('Login failed. Please try again.');
        router.push('/');
      }
    };

    handleCallback();
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
          ⏳
        </div>
        <h2 style={{
          margin: '0 0 8px 0',
          fontSize: '24px',
          fontWeight: '400',
          color: '#1f1f1f'
        }}>
          Completing Sign-In...
        </h2>
        <p style={{
          margin: 0,
          fontSize: '16px',
          color: '#5f6368'
        }}>
          Please wait while we set up your account.
        </p>
      </div>
    </div>
  );
} 