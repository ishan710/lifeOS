"""
Unified Email Service
Consolidates all email-related functionality: Gmail access, chunking, embeddings, and sync.
"""

import os
import logging
import base64
import html
from re import L
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
from agentic_backend.types.schema import Email, ApiResponse, Chunk, EmailEmbedding, User, dataclass_to_dict



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
    
    async def get_new_emails(
        self, 
        user: User, 
        query: str = "", 
        max_results: int = 10, 
        exclude_email_ids: Optional[List[str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Email]:
        """Get emails from Gmail API with optional date filtering."""
        credentials = await self._get_credentials(user.email)
        if not credentials:
            raise Exception("No Gmail credentials found. Please authenticate first.")
        
        try:
            service = build('gmail', 'v1', credentials=credentials)
            # Build query
            gmail_query = "category:primary"
            if query:
                gmail_query += f" {query}"
            
            # Add date filtering if provided
            if start_date and end_date:
                # Format dates for Gmail query (YYYY/MM/DD format)
                gmail_query += f" after:{start_date} before:{end_date}"
            elif start_date:
                gmail_query += f" after:{start_date}"
            elif end_date:
                gmail_query += f" before:{end_date}"
            
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
            emails: List[Email] = []
            for message in messages:
                try:
                    msg = service.users().messages().get(
                        userId='me', 
                        id=message['id'],
                        format='full'
                    ).execute()
                    
                    parsed_email = self._parse_email_message(msg, user)
                    emails.append(parsed_email)
                    
                except Exception as e:
                    logger.error(f"Error fetching message {message['id']}: {e}")
                    continue
            
            return emails
            
        except HttpError as error:
            logger.error(f"Gmail API error: {error}")
            raise Exception(f"Gmail API error: {error}")
    
    def _parse_email_message(self, message: Dict[str, Any], user: User) -> Email:
        """Parse Gmail message into structured format."""
        
        def find_header(name: str) -> str:
            payload = message.get('payload', {})
            headers = payload.get('headers', [])
            for header in headers:
                if header.get('name', '').lower() == name.lower():
                    return header.get('value', '')
            return ''
        
        body = self._extract_body(message.get('payload', {}))
        
        # Convert timestamp to datetime
        timestamp = message.get('internalDate', '')
        if timestamp:
            try:
                email_timestamp = datetime.fromtimestamp(int(timestamp) / 1000)
            except:
                email_timestamp = datetime.now()
        else:
            email_timestamp = datetime.now()
        
        return Email(
            email_id=message.get('id', ''),
            created_at=datetime.now(),
            email_timestamp=email_timestamp,
            user_email_id=user.email, 
            content=body,
            sender=find_header('from'),
        )
    
    def _extract_body(self, payload: Dict[str, Any]) -> str:
        """Extract text body from email payload."""
        import re
        
        def clean_text(text: str) -> str:
            """Clean and normalize text content."""
            if not text:
                return ""
            
            # Remove email reply markers (>>>>>>>>>>>>>>>>>>>)
            text = re.sub(r'^>+\s*', '', text, flags=re.MULTILINE)  # Remove leading > at start of lines
            text = re.sub(r'\n>+\s*', '\n', text, flags=re.MULTILINE)  # Remove > at start of lines after newlines
            text = re.sub(r'^>+\s*$', '', text, flags=re.MULTILINE)  # Remove lines that are only >
            
            # Remove common email reply patterns
            text = re.sub(r'On .* wrote:$', '', text, flags=re.MULTILINE | re.IGNORECASE)
            text = re.sub(r'From:.*\nSent:.*\nTo:.*\nSubject:.*', '', text, flags=re.MULTILINE | re.IGNORECASE)
            text = re.sub(r'From:.*\nDate:.*\nTo:.*\nSubject:.*', '', text, flags=re.MULTILINE | re.IGNORECASE)
            
            # Remove HTML and CSS
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'[\.#][a-zA-Z0-9\-_]+\s*\{[^}]*\}', '', text)
            text = re.sub(r'[a-zA-Z\-]+:\s*[^;]+;', '', text)
            text = re.sub(r'@media[^{]*\{[^}]*\}', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', '', text)
            
            # Decode HTML entities
            text = html.unescape(text)
            text = re.sub(r'&[a-zA-Z0-9#]+;', '', text)
            
            # Normalize whitespace
            text = ' '.join(text.split())
            text = re.sub(r'[^\x20-\x7E\n\r\t]', '', text)
            
            return text.strip()

        def extract_text_from_parts(parts: list) -> str:
            """Recursively extract text from multipart email."""
            for part in parts:
                mime_type = part.get("mimeType", "")
                body_data = part.get("body", {}).get("data", "")
                
                # Skip non-text content
                if mime_type.startswith('image/') or mime_type in [
                    'application/pdf', 
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/octet-stream',
                    'application/zip',
                    'application/x-zip-compressed'
                ]:
                    continue
                
                # Prefer text/plain over text/html
                if mime_type == "text/plain" and body_data:
                    try:
                        decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
                        cleaned = clean_text(decoded)
                        if cleaned:
                            return cleaned
                    except Exception as e:
                        logger.warning(f"Failed to decode text/plain: {e}")
                        continue
                
                # Fallback to text/html if no text/plain
                elif mime_type == "text/html" and body_data:
                    try:
                        decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
                        # Basic HTML tag removal
                        import re
                        html_cleaned = re.sub(r'<[^>]+>', '', decoded)  # Remove HTML tags
                        cleaned = clean_text(html_cleaned)
                        if cleaned:
                            return cleaned
                    except Exception as e:
                        logger.warning(f"Failed to decode text/html: {e}")
                        continue
                
                # Recursively check nested parts
                if "parts" in part:
                    result = extract_text_from_parts(part["parts"])
                    if result:
                        return result

            return ""

        # Handle multipart emails
        if "parts" in payload:
            result = extract_text_from_parts(payload["parts"])
            if result:
                return result

        # Handle single-part emails
        mime_type = payload.get("mimeType", "")
        data = payload.get("body", {}).get("data", "")
        
        if mime_type == "text/plain" and data:
            try:
                decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                return clean_text(decoded)
            except Exception as e:
                logger.warning(f"Failed to decode single-part text/plain: {e}")
        
        elif mime_type == "text/html" and data:
            try:
                decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                # Basic HTML tag removal
                import re
                html_cleaned = re.sub(r'<[^>]+>', '', decoded)  # Remove HTML tags
                return clean_text(html_cleaned)
            except Exception as e:
                logger.warning(f"Failed to decode single-part text/html: {e}")

        return ""
    
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

    
    async def sync_emails(
        self, 
        user: User, 
        max_emails: int = 50,
        batch_size: int = 10,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> ApiResponse:
        """Sync emails to Supabase and Pinecone in one step."""
        try:
            # Get emails from Gmail with date filtering
            existing_email_ids = await self._get_existing_email_ids(user)
            
            gmail_emails = await self.get_new_emails(
                user=user, 
                max_results=max_emails,
                start_date=start_date,
                end_date=end_date,
                exclude_email_ids=existing_email_ids
            )
            if not gmail_emails:
                            return ApiResponse(
                success=True,
                message=f"No new emails found in Gmail"
            )
        
            # Sync to both Supabase and Pinecone in batches
            errors = []

            for i in range(0, len(gmail_emails), batch_size):
                batch = gmail_emails[i:i + batch_size]
                batch_result = await self._sync_batch_to_supabase_and_pinecone(batch, user)
                if not batch_result.success:
                    errors.append(batch_result.message)
            
            return ApiResponse(
                success=True,
                message="Emails synced to Supabase and Pinecone"
            )
            
        except Exception as e:
            logger.error(f"Error syncing emails for user {user.id}: {e}")
            return ApiResponse(
                success=False,
                message=str(e)
            )
    
    async def _get_existing_email_ids(self, user: User) -> List[str]:
        """Get existing email IDs from Supabase."""
        try:
            if not user:
                return []
            
            response = self.supabase.supabase.table("emails").select("email_id").eq("user_email_id", user.email).execute()
            return [email['email_id'] for email in response.data] if response.data else []

        except Exception as e:
            logger.error(f"Error getting existing email IDs: {e}")
            return []
    
 
   
    async def _sync_batch_to_supabase_and_pinecone(
        self, 
        emails: List[Email], 
        user: User
    ) -> ApiResponse:
        """Sync a batch of emails to both Supabase and Pinecone."""
        try:
            batch_data: List[Email] = []
           
            # Process each email and store embeddings
            for email in emails:
                try:
                    batch_data.append(email)
                    await self._process_email_embeddings(email)
                except Exception as e:
                    return ApiResponse(
                        success=False,
                        message=f"Error processing email {email.email_id}: {str(e)}"
                    )
            
            # Sync to Supabase
            if batch_data:
                try:
                    # Convert Email dataclass objects to dictionaries for Supabase
                    batch_dicts = [dataclass_to_dict(email) for email in batch_data]
                    
                    response = self.supabase.supabase.table("emails").insert(batch_dicts).execute()
                except Exception as insert_error:
                    return ApiResponse(
                        success=False,
                        message=f"Supabase insert error: {str(insert_error)}"
                    )
            
            return ApiResponse(
                success=True,
                message="Emails synced to Supabase and Pinecone"
            )
            
        except Exception as e:
            logger.error(f"Error syncing batch to Supabase and Pinecone: {e}")
            return ApiResponse(
                success=False,
                message=str(e)
            )
    
    # ==================== Embedding Methods ====================
    
    async def _process_email_embeddings(self, email: Email) -> ApiResponse:
        """Process and store embeddings for a single email."""
        try:
            # Create searchable text
            email_text = self._create_email_text(email)
            if not email_text.strip():
                return ApiResponse(
                    success=True,
                    message=f"No email text found for {email.email_id}"
                )
            
            chunks = await self.text_chunking_service.chunk_text(email_text, max_chunk_size=1000, overlap=100, email_id=email.email_id)
            
            # Store each chunk
            for i, chunk in enumerate(chunks):
                result = await self._store_chunk_embedding(
                    chunk=chunk,
                    email=email
                )
                if not result.success:
                    return result
            
            return ApiResponse(
                success=True,
                message=f"Successfully processed {len(chunks)} chunks for email {email.email_id}"
            )
        except Exception as e:
            logger.error(f"Error processing email embeddings for {email.email_id}: {e}")
            return ApiResponse(
                success=False,
                message=f"Error processing email embeddings for {email.email_id}: {e}"
            )
    
    def _create_email_text(self, email: Email) -> str:
        """Create searchable text from email data."""
        return email.content
    
    async def _store_chunk_embedding(
        self, 
        chunk: Chunk,
        email: Email
    ) -> ApiResponse:
        """Store a single chunk embedding in Pinecone."""
        try:
            # Generate embedding
            embedding = self.vector_store.get_embedding(chunk.chunk_text)
            
            # Create vector ID
            vector_id = f"email_{email.email_id}_chunk_{chunk.chunk_id}"
            
            # Create vector data for Pinecone (must be a dictionary)
            vector_data = {
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "email_id": email.email_id,
                    "chunk_id": chunk.chunk_id,
                    "chunk_text": chunk.chunk_text,
                    "chunk_type": chunk.chunk_type,
                    "type": "email_chunk"
                }
            }
            
            # Store in Pinecone
            self.vector_store.add_documents([vector_data])

            return ApiResponse(
                success=True,
                message=f"Chunk embedding stored for {email.email_id}"
            )
        except Exception as e:
            logger.error(f"Error storing chunk embedding: {e}")
            return ApiResponse(
                success=False,
                message=f"Error storing chunk embedding: {e}"
            )
    
    # ==================== Statistics Methods ====================
    
    async def get_embedding_stats(self, user_id: str) -> Dict[str, Any]:
        """Get statistics about email embeddings for a user."""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return {"error": f"User {user_id} not found"}
            
            # Get Pinecone index stats
            pinecone_stats = self.vector_store.get_index_stats()
            
            # Count user's email embeddings in Pinecone
            # This is a simplified approach - in production you'd want to filter by user_id
            total_vectors = pinecone_stats.get('total_vector_count', 0) if pinecone_stats else 0
            
            return {
                "total_emails": total_vectors,
                "user_id": user_id,
                "index_name": self.vector_store.index_name
            }
                
        except Exception as e:
            logger.error(f"Error getting embedding stats: {e}")
            return {"error": str(e)}
    
    async def get_sync_stats(self, user_id: str) -> Dict[str, Any]:
        """Get email sync statistics for a user."""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return {"error": f"User {user_id} not found"}
            
            # Get stats from Supabase
            response = self.supabase.supabase.table("emails").select("*").eq("user_email_id", user.email).execute()
            
            if response.data:
                total_emails = len(response.data)
                # For now, assume all emails are processed since we process them during sync
                processed_emails = total_emails
                unprocessed_emails = 0
                
                return {
                    "total_emails_count": total_emails,
                    "processed_emails_count": processed_emails,
                    "unprocessed_emails_count": unprocessed_emails,
                    "last_sync_date": max(email.get('created_at', '') for email in response.data) if response.data else None
                }
            else:
                return {
                    "total_emails_count": 0,
                    "processed_emails_count": 0,
                    "unprocessed_emails_count": 0,
                    "last_sync_date": None
                }
                
        except Exception as e:
            logger.error(f"Error getting sync stats: {e}")
            return {"error": str(e)}
    
    # ==================== Clear/Delete Methods ====================    
    
    async def clear_all_email_embeddings(self) -> Dict[str, Any]:
        """Clear ALL email embeddings from Pinecone (admin function)"""
        try:
            success = self.vector_store.delete_all_vectors()
            if success:
                return {
                    "success": True,
                    "message": "Successfully cleared all email embeddings from Pinecone"
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to clear embeddings from Pinecone"
                }
                
        except Exception as e:
            logger.error(f"Error clearing all email embeddings: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def clear_user_supabase_data(self, user_id: str) -> Dict[str, Any]:
        """Clear all email data for a specific user from Supabase"""
        try:
            user = await self.supabase.get_user_by_email(user_id)
            if not user:
                return {
                    "success": False,
                    "error": f"User {user_id} not found"
                }
            
            # Delete all emails for this user from Supabase
            response = self.supabase.supabase.table("emails").delete().eq("user_email_id", user.email).execute()
            
            return {
                "success": True,
                "message": f"Successfully cleared all email data for user {user_id} from Supabase"
            }
                
        except Exception as e:
            logger.error(f"Error clearing user Supabase data: {e}")
            return {
                "success": False,
                "error": str(e)
            }
