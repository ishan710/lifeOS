"""
Unified Email Service
Consolidates all email-related functionality: Gmail access, chunking, embeddings, and sync.
"""

import os
import logging
import base64
from typing import Dict, List, Optional, Any
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from agentic_backend.config.settings import settings
from agentic_backend.services.supabase_service import SupabaseService
from agentic_backend.vector_store import VectorStore
from agentic_backend.services.text_chunking_service import TextChunkingService

logger = logging.getLogger(__name__)


class EmailService:
    """Unified service for all email operations"""
    
    def __init__(self):
        # Gmail OAuth
        self.credentials_store: Dict[str, Any] = {}
        self.client_id = settings.google_client_id
        self.client_secret = settings.google_client_secret
        
        # Services
        self.supabase = SupabaseService()
        self.vector_store = VectorStore()
        self.text_chunking_service = TextChunkingService()
        
        if not self.client_id or not self.client_secret:
            logger.warning("Google OAuth credentials not configured")
    
    # ==================== Gmail OAuth Methods ====================
    
    def get_authorization_url(self, user_id: str) -> str:
        """Generate OAuth URL for Gmail access."""
        if not self.client_id or not self.client_secret:
            raise Exception("Google OAuth credentials not configured")
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": ["http://localhost:3000/gmail-callback"]
                }
            },
            scopes=["https://www.googleapis.com/auth/gmail.readonly"]
        )
        flow.redirect_uri = "http://localhost:3000/gmail-callback"
        
        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            state=user_id
        )
        return auth_url

    async def handle_oauth_callback(self, code: str, state: str) -> Dict[str, Any]:
        """Handle OAuth callback and store credentials."""
        if not self.client_id or not self.client_secret:
            raise Exception("Google OAuth credentials not configured")
        
        try:
            flow = Flow.from_client_config(
                {
                    "web": {
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": ["http://localhost:3000/gmail-callback"]
                    }
                },
                scopes=["https://www.googleapis.com/auth/gmail.readonly"]
            )
            flow.redirect_uri = "http://localhost:3000/gmail-callback"
            
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            logger.info(f"Storing credentials for user_id: {state}")
            self.credentials_store[state] = credentials
            
            return {"success": True, "message": "Gmail connected successfully"}
            
        except Exception as e:
            logger.error(f"OAuth callback failed: {e}")
            return {"success": False, "error": str(e)}

    async def _get_credentials(self, user_id: str) -> Optional[Credentials]:
        """Get valid credentials for user, refresh if needed."""
        credentials = self.credentials_store.get(user_id)
        
        if not credentials:
            logger.warning(f"No credentials found for user_id: {user_id}")
            return None
        
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                self.credentials_store[user_id] = credentials
                logger.info(f"Refreshed credentials for user_id: {user_id}")
            except Exception as e:
                logger.error(f"Failed to refresh credentials for user_id {user_id}: {e}")
                return None
        
        return credentials
    
    # ==================== Gmail API Methods ====================
    
    async def get_emails(
        self, 
        user_id: str, 
        query: str = "", 
        max_results: int = 10, 
        exclude_email_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Get emails from Gmail API."""
        credentials = await self._get_credentials(user_id)
        if not credentials:
            raise Exception("No Gmail credentials found. Please authenticate first.")
        
        try:
            service = build('gmail', 'v1', credentials=credentials)
            
            # Build query
            gmail_query = "category:primary"
            if query:
                gmail_query += f" {query}"
            
            # Get messages
            results = service.users().messages().list(
                userId='me',
                q=gmail_query,
                maxResults=max_results
            ).execute()
            
            messages = results.get('messages', [])
            if not messages:
                return []
            
            # Filter out excluded email IDs
            if exclude_email_ids:
                messages = [msg for msg in messages if msg['id'] not in exclude_email_ids]
            
            # Get full message details
            emails = []
            for message in messages:
                try:
                    msg = service.users().messages().get(
                        userId='me', 
                        id=message['id'],
                        format='full'
                    ).execute()
                    
                    parsed_email = self._parse_email_message(msg)
                    emails.append(parsed_email)
                    
                except Exception as e:
                    logger.error(f"Error fetching message {message['id']}: {e}")
                    continue
            
            return emails
            
        except HttpError as error:
            logger.error(f"Gmail API error: {error}")
            raise Exception(f"Gmail API error: {error}")
    
    def _parse_email_message(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Parse Gmail message into structured format."""
        def find_header(name: str) -> str:
            headers = message.get('payload', {}).get('headers', [])
            for header in headers:
                if header.get('name', '').lower() == name.lower():
                    return header.get('value', '')
            return ''
        
        return {
            'id': message.get('id', ''),
            'threadId': message.get('threadId', ''),
            'subject': find_header('subject'),
            'from': find_header('from'),
            'to': find_header('to'),
            'date': find_header('date'),
            'body': self._extract_body(message.get('payload', {})),
            'snippet': message.get('snippet', '')
        }
    
    def _extract_body(self, payload: Dict[str, Any]) -> str:
        """Extract text body from email payload."""
        def extract_text_from_payload(payload_part: Dict[str, Any]) -> str:
            if 'parts' in payload_part:
                # Multipart message
                for part in payload_part['parts']:
                    mime_type = part.get('mimeType', '')
                    
                    # Skip non-text content
                    if mime_type.startswith('image/') or mime_type in [
                        'application/pdf', 
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/octet-stream'
                    ]:
                        continue
                    
                    if mime_type == 'text/plain':
                        # Found plain text part
                        data = part.get('body', {}).get('data', '')
                        if data:
                            try:
                                text = base64.urlsafe_b64decode(data).decode('utf-8')
                                return text
                            except Exception as e:
                                logger.warning(f"Error decoding text part: {e}")
                    
                    # Recursively check nested parts
                    if 'parts' in part:
                        result = extract_text_from_payload(part)
                        if result:
                            return result
            
            # Single part message
            mime_type = payload_part.get('mimeType', '')
            if mime_type == 'text/plain':
                data = payload_part.get('body', {}).get('data', '')
                if data:
                    try:
                        text = base64.urlsafe_b64decode(data).decode('utf-8')
                        # Clean up text
                        text = ' '.join(text.split())  # Normalize whitespace
                        return text
                    except Exception as e:
                        logger.warning(f"Error decoding single part: {e}")
            
            return ""
        
        return extract_text_from_payload(payload)
    
    async def test_connection(self, user_id: str) -> Dict[str, Any]:
        """Test Gmail connection."""
        try:
            credentials = await self._get_credentials(user_id)
            if not credentials:
                return {"success": False, "error": "No credentials found"}
            
            service = build('gmail', 'v1', credentials=credentials)
            profile = service.users().getProfile(userId='me').execute()
            
            return {
                "success": True,
                "email": profile.get('emailAddress'),
                "messagesTotal": profile.get('messagesTotal'),
                "threadsTotal": profile.get('threadsTotal')
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # ==================== Supabase Sync Methods ====================
    
    async def sync_emails_to_supabase(
        self, 
        user_id: str, 
        max_emails: int = 50,
        batch_size: int = 10
    ) -> Dict[str, Any]:
        """Sync emails to Supabase in batches."""
        try:
            # Get emails from Gmail
            gmail_emails = await self.get_emails(user_id, max_results=max_emails)
            
            if not gmail_emails:
                return {
                    "success": True,
                    "message": "No emails found in Gmail",
                    "total_emails": 0,
                    "synced_to_supabase": 0
                }
            
            # Get existing email IDs from Supabase to avoid duplicates
            existing_email_ids = await self._get_existing_email_ids(user_id)
            
            # Filter out already synced emails
            new_emails = [
                email for email in gmail_emails 
                if email.get('id') and email.get('id') not in existing_email_ids
            ]
            
            if not new_emails:
                return {
                    "success": True,
                    "message": "All emails already synced to Supabase",
                    "total_emails": len(gmail_emails),
                    "synced_to_supabase": 0
                }
            
            # Sync to Supabase in batches
            successful = 0
            errors = []
            
            for i in range(0, len(new_emails), batch_size):
                batch = new_emails[i:i + batch_size]
                batch_result = await self._sync_batch_to_supabase(batch, user_id)
                successful += batch_result["successful"]
                errors.extend(batch_result["errors"])
            
            return {
                "success": True,
                "total_emails": len(gmail_emails),
                "new_emails": len(new_emails),
                "synced_to_supabase": successful,
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Error syncing emails for user {user_id}: {e}")
            return {"success": False, "error": str(e)}
    
    async def _get_existing_email_ids(self, user_id: str) -> List[str]:
        """Get existing email IDs from Supabase."""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return []
            
            # Query the emails table using the correct schema
            response = self.supabase.supabase.table("emails").select("email_id").eq("user_id", user['id']).execute()
            return [email['email_id'] for email in response.data] if response.data else []
            
        except Exception as e:
            logger.error(f"Error getting existing email IDs: {e}")
            return []
    
    async def _sync_batch_to_supabase(
        self, 
        emails: List[Dict[str, Any]], 
        user_id: str
    ) -> Dict[str, Any]:
        """Sync a batch of emails to Supabase."""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return {"successful": 0, "errors": [f"User {user_id} not found"]}
            
            batch_data = []
            for email in emails:
                # Ensure content is not null (required field in schema)
                content = email.get('body', '')
                if not content:
                    content = email.get('snippet', '') or 'No content available'
                
                email_data = {
                    "email_id": email.get('id'),
                    "user_id": user['id'],
                    "subject": email.get('subject', ''),
                    "content": content,
                    "processed": False
                }
                batch_data.append(email_data)
            
            if batch_data:
                print("batch_data", len(batch_data))
                try:
                    response = self.supabase.supabase.table("emails").insert(batch_data).execute()
                    return {"successful": len(response.data) if response.data else 0, "errors": []}
                except Exception as insert_error:
                    # Handle unique constraint violations gracefully
                    if "duplicate key value violates unique constraint" in str(insert_error):
                        logger.warning(f"Duplicate emails detected, skipping batch")
                        return {"successful": 0, "errors": ["Duplicate emails detected"]}
                    else:
                        raise insert_error
            
            return {"successful": 0, "errors": []}
            
        except Exception as e:
            logger.error(f"Error syncing batch to Supabase: {e}")
            return {"successful": 0, "errors": [str(e)]}
    
    # ==================== Embedding Methods ====================
    
    async def store_email_embeddings(
        self, 
        user_id: str, 
        max_emails: int = 50
    ) -> Dict[str, Any]:
        """Store email embeddings in Pinecone."""
        try:
            # Get unprocessed emails from Supabase
            unprocessed_emails = await self._get_unprocessed_emails(user_id, max_emails)
            
            if not unprocessed_emails:
                return {
                    "success": True,
                    "message": "No unprocessed emails found",
                    "processed": 0
                }
            
            successful = 0
            errors = []
            
            for email in unprocessed_emails:
                try:
                    # Create searchable text
                    email_text = self._create_email_text(email)
                    if not email_text.strip():
                        continue
                    
                    # Chunk the email content
                    chunks = self.text_chunking_service.chunk_text(email_text, max_chunk_size=1000, overlap=100)
                    
                    # Store each chunk
                    for i, chunk in enumerate(chunks):
                        await self._store_chunk_embedding(
                            email_id=email['email_id'],
                            user_id=user_id,
                            chunk_index=i,
                            chunk_text=str(chunk),
                            email_metadata=email
                        )
                    
                    # Mark email as processed
                    await self._mark_email_processed(email['email_id'], user_id)
                    successful += 1
                    
                except Exception as e:
                    errors.append(f"Error processing email {email.get('email_id')}: {str(e)}")
            
            return {
                "success": True,
                "processed": successful,
                "errors": errors
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def _get_unprocessed_emails(self, user_id: str, max_emails: int) -> List[Dict[str, Any]]:
        """Get unprocessed emails from Supabase."""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return []
            
            response = self.supabase.supabase.table("emails").select("*").eq("user_id", user['id']).eq("processed", False).limit(max_emails).execute()
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Error getting unprocessed emails: {e}")
            return []
    
    def _create_email_text(self, email: Dict[str, Any]) -> str:
        """Create searchable text from email data."""
        parts = []
        
        if email.get('subject'):
            parts.append(f"Subject: {email['subject']}")
        
        if email.get('content'):
            parts.append(f"Content: {email['content'][:8000]}")
        
        return "\n".join(parts)
    
    async def _store_chunk_embedding(
        self, 
        email_id: str, 
        user_id: str, 
        chunk_index: int, 
        chunk_text: str,
        email_metadata: Dict[str, Any]
    ):
        """Store a single chunk embedding in Pinecone."""
        try:
            # Generate embedding
            embedding = self.vector_store.get_embedding(chunk_text)
            
            # Create vector ID
            vector_id = f"email_{user_id}_{email_id}_chunk_{chunk_index}"
            
            # Create vector data
            vector_data = {
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "email_id": email_id,
                    "user_id": user_id,
                    "chunk_index": chunk_index,
                    "type": "email_chunk",
                    "subject": email_metadata.get('subject', ''),
                    "content_preview": chunk_text[:200] + "..." if len(chunk_text) > 200 else chunk_text,
                    "word_count": len(chunk_text.split())
                }
            }
            
            # Store in Pinecone
            self.vector_store.add_documents([vector_data])
            
        except Exception as e:
            logger.error(f"Error storing chunk embedding: {e}")
            raise
    
    async def _mark_email_processed(self, email_id: str, user_id: str):
        """Mark email as processed in Supabase."""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return
            
            self.supabase.supabase.table("emails").update({"processed": True}).eq("email_id", email_id).eq("user_id", user['id']).execute()
            
        except Exception as e:
            logger.error(f"Error marking email as processed: {e}")
    
    # ==================== Search Methods ====================
    
    async def search_emails(
        self, 
        query: str, 
        user_id: str, 
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Search emails using vector similarity."""
        try:
            # Generate query embedding
            query_embedding = self.vector_store.get_embedding(query)
            
            # Search in Pinecone
            search_results = self.vector_store.search(
                embedding=query_embedding,
                top_k=top_k,
                filter={"user_id": user_id}
            )
            
            # Process results
            results = []
            try:
                matches = search_results.matches if hasattr(search_results, 'matches') else []
                for match in matches:
                    if hasattr(match, 'metadata') and match.metadata:
                        results.append({
                            "email_id": match.metadata.get("email_id"),
                            "chunk_index": match.metadata.get("chunk_index"),
                            "subject": match.metadata.get("subject"),
                            "content_preview": match.metadata.get("content_preview"),
                            "similarity_score": getattr(match, 'score', 0.0)
                        })
            except Exception as e:
                logger.warning(f"Error processing search results: {e}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error searching emails: {e}")
            return []
    
    # ==================== Statistics Methods ====================
    
    async def get_email_stats(self, user_id: str) -> Dict[str, Any]:
        """Get email statistics for a user."""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return {"error": f"User {user_id} not found"}
            
            # Get stats from Supabase
            response = self.supabase.supabase.table("emails").select("*").eq("user_id", user['id']).execute()
            
            if response.data:
                total_emails = len(response.data)
                processed_emails = sum(1 for email in response.data if email.get('processed', False))
                unprocessed_emails = total_emails - processed_emails
                
                return {
                    "total_emails": total_emails,
                    "processed_emails": processed_emails,
                    "unprocessed_emails": unprocessed_emails,
                    "last_sync": max(email.get('created_at', '') for email in response.data) if response.data else None
                }
            else:
                return {
                    "total_emails": 0,
                    "processed_emails": 0,
                    "unprocessed_emails": 0,
                    "last_sync": None
                }
                
        except Exception as e:
            logger.error(f"Error getting email stats: {e}")
            return {"error": str(e)} 