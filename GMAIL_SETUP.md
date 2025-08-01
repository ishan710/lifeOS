# Gmail Integration Setup Guide

This guide will help you set up Gmail integration for your LifeOS app, allowing users to connect their Gmail accounts to read emails, send emails, and automatically create tasks from email content.

## Prerequisites

- Google Cloud Platform account
- Supabase database access
- OpenAI API key (for email content analysis)

## Step 1: Google Cloud Console Setup

### 1.1 Create a New Project (or use existing)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

### 1.2 Enable Gmail API
1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for "Gmail API"
3. Click "Gmail API" and click **Enable**
4. Also enable "Google+ API" for user profile information

### 1.3 Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type (unless you have Google Workspace)
3. Fill in the required fields:
   - **App name**: LifeOS
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. Add test users (your email addresses that will test the integration)

### 1.4 Create OAuth Credentials
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Set the name: "LifeOS Gmail Integration"
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/gmail/callback` (for development)
   - Your production domain callback URL
6. Download the credentials JSON file
7. Note the **Client ID** and **Client Secret**

## Step 2: Environment Variables

Add these environment variables to your `.env` file:

```env
# Gmail OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/gmail/callback

# JWT for session management
JWT_SECRET_KEY=your_super_secret_jwt_key_here_change_this
```

## Step 3: Database Schema

Create the following table in your Supabase database:

```sql
-- Gmail credentials storage
CREATE TABLE IF NOT EXISTS gmail_credentials (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    credentials JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_gmail_credentials_user_id ON gmail_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_credentials_email ON gmail_credentials(email);

-- RLS policies (adjust based on your auth setup)
ALTER TABLE gmail_credentials ENABLE ROW LEVEL SECURITY;

-- Example policy - adjust based on your auth system
CREATE POLICY "Users can manage their own gmail credentials" ON gmail_credentials
    FOR ALL USING (auth.uid()::text = user_id);
```

## Step 4: Install Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

The requirements.txt should include:
- `google-auth`
- `google-auth-oauthlib`
- `google-auth-httplib2`
- `google-api-python-client`
- `authlib`
- `python-jose[cryptography]`

## Step 5: Frontend Integration

### 5.1 Add Gmail API Functions

Create or update `src/lib/api.ts`:

```typescript
// Gmail OAuth
export async function getGmailAuthUrl(userId: string) {
  const res = await fetch(`${API_URL}/gmail/auth-url?user_id=${encodeURIComponent(userId)}`);
  return res.json();
}

export async function handleGmailOAuthCallback(code: string, state: string) {
  const res = await fetch(`${API_URL}/gmail/oauth-callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, state }),
  });
  return res.json();
}

export async function getEmails(userId: string, query: string = "", maxResults: number = 10) {
  const res = await fetch(
    `${API_URL}/gmail/emails?user_id=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}&max_results=${maxResults}`
  );
  return res.json();
}

export async function sendEmail(userId: string, to: string, subject: string, body: string, bodyHtml?: string) {
  const res = await fetch(`${API_URL}/gmail/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, to, subject, body, body_html: bodyHtml }),
  });
  return res.json();
}

export async function createTasksFromEmails(userId: string, userName: string) {
  const res = await fetch(`${API_URL}/gmail/create-tasks-from-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, user_name: userName }),
  });
  return res.json();
}

export async function getGmailStatus(userId: string) {
  const res = await fetch(`${API_URL}/gmail/status?user_id=${encodeURIComponent(userId)}`);
  return res.json();
}
```

### 5.2 Create Gmail Component

Create `src/components/GmailIntegration.tsx`:

```typescript
"use client";
import React, { useState, useEffect } from 'react';
import { getGmailAuthUrl, getGmailStatus, getEmails, createTasksFromEmails } from '../lib/api';

interface GmailIntegrationProps {
  userId: string;
  userName: string;
}

const GmailIntegration: React.FC<GmailIntegrationProps> = ({ userId, userName }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    checkGmailStatus();
  }, [userId]);

  const checkGmailStatus = async () => {
    try {
      const status = await getGmailStatus(userId);
      setIsConnected(status.is_connected);
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectGmail = async () => {
    try {
      const { auth_url } = await getGmailAuthUrl(userId);
      window.location.href = auth_url;
    } catch (error) {
      console.error('Error getting Gmail auth URL:', error);
    }
  };

  const fetchEmails = async () => {
    try {
      const { emails } = await getEmails(userId, 'is:unread', 5);
      setEmails(emails);
    } catch (error) {
      console.error('Error fetching emails:', error);
    }
  };

  const createTasks = async () => {
    try {
      const result = await createTasksFromEmails(userId, userName);
      alert(`Created ${result.created_tasks.length} tasks from emails!`);
    } catch (error) {
      console.error('Error creating tasks:', error);
    }
  };

  if (loading) return <div>Loading Gmail status...</div>;

  return (
    <div style={{ padding: 20, border: '1px solid #ddd', borderRadius: 8, margin: 16 }}>
      <h3>📧 Gmail Integration</h3>
      
      {!isConnected ? (
        <div>
          <p>Connect your Gmail to automatically create tasks from emails</p>
          <button onClick={connectGmail} style={{ 
            padding: '10px 20px', 
            backgroundColor: '#4285f4', 
            color: 'white', 
            border: 'none', 
            borderRadius: 4 
          }}>
            Connect Gmail
          </button>
        </div>
      ) : (
        <div>
          <p>✅ Gmail connected successfully!</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button onClick={fetchEmails}>Fetch Recent Emails</button>
            <button onClick={createTasks}>Create Tasks from Emails</button>
          </div>
          
          {emails.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4>Recent Emails:</h4>
              {emails.map((email: any) => (
                <div key={email.id} style={{ 
                  padding: 10, 
                  margin: '5px 0', 
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4 
                }}>
                  <strong>{email.subject}</strong>
                  <br />
                  <small>From: {email.from}</small>
                  <br />
                  <small>{email.snippet}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GmailIntegration;
```

## Step 6: Testing

1. **Start your backend server**:
   ```bash
   cd agentic_backend
   python -m uvicorn main:app --reload --port 8000
   ```

2. **Start your frontend**:
   ```bash
   cd my-lifeos-frontend
   npm run dev
   ```

3. **Test the OAuth flow**:
   - Add the GmailIntegration component to your main page
   - Click "Connect Gmail"
   - Complete the OAuth flow
   - Test fetching emails and creating tasks

## Step 7: Production Deployment

For production:

1. **Update OAuth redirect URI** in Google Cloud Console to your production domain
2. **Update environment variables** with production values
3. **Set up proper HTTPS** (required for OAuth in production)
4. **Consider implementing proper user authentication** before Gmail access

## Features Included

✅ **OAuth 2.0 Authentication** - Secure Gmail access  
✅ **Email Reading** - Fetch emails with search queries  
✅ **Email Sending** - Send emails through Gmail  
✅ **Automatic Task Creation** - AI analyzes emails and creates tasks  
✅ **Credential Management** - Secure storage and refresh of tokens  
✅ **Error Handling** - Comprehensive error handling and logging  

## Security Considerations

- Credentials are stored encrypted in Supabase
- OAuth tokens are automatically refreshed
- Row Level Security (RLS) should be configured
- Use HTTPS in production
- Regularly audit access permissions

## Troubleshooting

### Common Issues:

1. **"Access blocked" error**: Make sure your app is approved by Google or add test users
2. **"Invalid redirect URI"**: Check that redirect URIs match exactly in Google Cloud Console
3. **"Credentials not found"**: Verify environment variables are set correctly
4. **"Scope not authorized"**: Ensure all required scopes are added in OAuth consent screen

### Debug Steps:

1. Check backend logs for detailed error messages
2. Verify database tables are created correctly
3. Test API endpoints individually using curl or Postman
4. Check Google Cloud Console audit logs for OAuth attempts

## API Endpoints Reference

- `GET /api/gmail/auth-url?user_id={id}` - Get OAuth URL
- `POST /api/gmail/oauth-callback` - Handle OAuth callback
- `GET /api/gmail/emails?user_id={id}&query={query}` - Fetch emails
- `POST /api/gmail/send` - Send email
- `POST /api/gmail/create-tasks-from-emails` - Create tasks from emails
- `GET /api/gmail/status?user_id={id}` - Check connection status

---

That's it! Your Gmail integration should now be fully functional. Users can connect their Gmail accounts and automatically create tasks from their email content using AI analysis. 