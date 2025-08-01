from fastapi import APIRouter, Request, HTTPException, Query
# from agentic_backend.core.orchestrator import handle_user_input
from agentic_backend.vector_store import VectorStore
from agentic_backend.services.supabase_service import SupabaseService
from agentic_backend.services.note_processor import NoteProcessor
from agentic_backend.config.settings import settings
from pinecone import Pinecone, ServerlessSpec
import os
import uuid
from agentic_backend.services.email_service import EmailService
from agentic_backend.services.email_chat_service import ChatService



router = APIRouter()
vector_store = VectorStore()
supabase_service = SupabaseService()
note_processor = NoteProcessor()
email_service = EmailService()
chat_service = ChatService()



@router.post("/note/add")
async def add_note(request: Request):
    data = await request.json()
    note_text = data.get("text", "")
    user_name = data.get("user_name")
    note_id = data.get("id", None) or str(uuid.uuid4())
    
    # Generate embedding
    embedding = vector_store.get_embedding(note_text)
    
    # Store in Pinecone (for semantic search)
    document = {
        "id": note_id,
        "values": embedding,
        "metadata": {"text": note_text, "user": user_name or "anonymous"}
    }
    vector_store.add_documents([document])
    
    # Store in Supabase (for relational data)
    await supabase_service.store_note(note_id, note_text, user_name, embedding)
    
    # Process note with agent
    processing_result = await note_processor.process_note(note_id, note_text, user_name)
    
    return {
        "status": "success",
        "id": note_id,
        "message": "Note processed",
        "created_tasks": processing_result["created_tasks"]
    }

@router.get("/tasks")
async def get_tasks(user_name: str):
    """Get all tasks for a user"""
    tasks = await supabase_service.get_user_tasks(user_name)
    return {"tasks": tasks.data if tasks.data else []}

@router.post("/tasks/{task_id}/complete")
async def complete_task(task_id: int):
    """Mark a task as completed"""
    result = await supabase_service.complete_task(task_id)
    return {"status": "success", "message": "Task completed"}


# Google Authentication Endpoints

@router.post("/auth/google/exchange-code")
async def exchange_google_code(request: Request):
    """Exchange Google OAuth code for user information and create/get user"""
    import httpx
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        data = await request.json()
        code = data.get("code")
        
        if not code:
            raise HTTPException(status_code=400, detail="Authorization code is required")
        
        # Check if we have the required settings
        if not settings.google_client_id or not settings.google_client_secret:
            logger.error("Missing Google OAuth credentials in settings")
            raise HTTPException(status_code=500, detail="Google OAuth not configured")
        
        # Exchange code for access token
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": "http://localhost:3000/auth/callback", 
            "grant_type": "authorization_code",
        }
        
        
        async with httpx.AsyncClient() as client:
            token_response = await client.post(token_url, data=token_data)
            
            if token_response.status_code != 200:
                logger.error(f"Token exchange failed: {token_response.text}")
                raise HTTPException(status_code=400, detail=f"Token exchange failed: {token_response.text}")
            
            token_result = token_response.json()
        
        # Get user info from Google
        access_token = token_result.get('access_token')
        if not access_token:
            raise HTTPException(status_code=500, detail="No access token received")
            
        user_info_url = f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}"
        
        async with httpx.AsyncClient() as client:
            user_response = await client.get(user_info_url)
            
            if user_response.status_code != 200:
                logger.error(f"User info failed: {user_response.text}")
                raise HTTPException(status_code=400, detail="Failed to get user info")
                
            user_data = user_response.json()
        
        # Extract real user data from Google
        email = user_data.get("email")
        name = user_data.get("name")
        picture = user_data.get("picture")
        
        if not email or not name:
            logger.error(f"Missing user data - email: {email}, name: {name}")
            raise HTTPException(status_code=400, detail="Incomplete user data from Google")
        
        # Create or get user in our database using REAL Google data
        result = await supabase_service.create_or_get_user(email, name)
        
        if result["success"]:
            # Store Gmail credentials for this user (using email as user_id)
            try:
                # Create credentials object from the OAuth tokens
                from google.oauth2.credentials import Credentials
                
                # Get all scopes from the token response
                scope_string = token_result.get('scope', '')
                scopes = scope_string.split(' ') if scope_string else [
                    "https://www.googleapis.com/auth/userinfo.email",
                    "https://www.googleapis.com/auth/userinfo.profile", 
                    "https://www.googleapis.com/auth/gmail.readonly"
                ]
                
                logger.info(f"OAuth token result scopes: {scope_string}")
                logger.info(f"Creating credentials with scopes: {scopes}")
                
                # Check if Gmail scope is actually present
                if not any('gmail' in scope for scope in scopes):
                    logger.warning(f"Gmail scope missing from OAuth response. Available scopes: {scopes}")
                    logger.warning("User will need to sign in again with Gmail permissions")
                
                credentials = Credentials(
                    token=access_token,
                    refresh_token=token_result.get('refresh_token'),
                    token_uri="https://oauth2.googleapis.com/token",
                    client_id=settings.google_client_id,
                    client_secret=settings.google_client_secret,
                    scopes=scopes
                )
                
                # Store Gmail credentials using email as user_id
                email_service.credentials_store[email] = credentials
                logger.info(f"Stored Gmail credentials for user: {email} with scopes: {scopes}")
                
            except Exception as e:
                logger.warning(f"Failed to store Gmail credentials: {e}")
                logger.error(f"Token result: {token_result}")
                logger.error(f"Access token present: {bool(access_token)}")
            
            # Add Google profile picture to user data
            user_with_picture = result["user"].copy()
            user_with_picture["picture"] = picture
            user_with_picture["gmail_connected"] = True  # Indicate Gmail is connected
            
            return {
                "success": True,
                "user": user_with_picture,
                "is_new_user": result["is_new"],
                "message": f"Welcome {name}! Authenticated with {email} and Gmail access granted"
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to create user"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in OAuth exchange: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")


@router.get("/gmail-callback")
async def handle_gmail_callback(code: str = Query(...), state: str = Query(...)):
    """Handle Gmail OAuth callback from Google redirect"""
    try:
        result = await email_service.handle_oauth_callback(code, state)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

@router.get("/gmail/emails")
async def get_emails(
    user_id: str = Query(..., description="User ID"),
    query: str = Query("", description="Gmail search query"),
    max_results: int = Query(10, description="Maximum number of emails to fetch")
):
    """Get emails from Gmail"""
    try:
        emails = await email_service.get_emails(user_id, query, max_results)
        return {"emails": emails}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch emails: {str(e)}")

@router.get("/gmail/test-connection")
async def test_gmail_connection(user_id: str = Query(...)):
    """Test Gmail connection for a user."""
    try:
        result = await email_service.test_connection(user_id)
        return result
    except Exception as e:
        return {"connected": False, "error": str(e)}

@router.get("/gmail/email-count")
async def get_email_count(user_id: str = Query(..., description="User ID")):
    """Get total number of emails (approximately)"""
    try:
        credentials = await email_service._get_credentials(user_id)
        if not credentials:
            return {"error": "No Gmail credentials found"}
        
        # Get emails with different queries to show counts
        all_emails = await email_service.get_emails(user_id, query="", max_results=50)
        unread_emails = await email_service.get_emails(user_id, query="is:unread", max_results=20)
        
        return {
            "recent_emails_count": len(all_emails),
            "unread_count": len(unread_emails),
            "latest_emails": all_emails[:5]  # Show 5 most recent
        }
    except Exception as e:
        return {"error": str(e)}


# Email Embedding & RAG Endpoints

@router.post("/emails/embeddings/store")
async def store_email_embeddings(user_id: str = Query(...), max_emails: int = Query(default=50)):
    """Store email embeddings in Pinecone for RAG"""
    try:
        # Get recent emails from Gmail
        emails = await email_service.get_emails(user_id, query="", max_results=max_emails)
        
        if not emails:
            return {"success": False, "message": "No emails found to process - check Gmail credentials"}
        
        # Store embeddings using unified service
        results = await email_service.store_email_embeddings(user_id, max_emails)
        
        return {
            "success": True,
            "message": f"Processed {len(emails)} emails",
            "results": results,
            "sample_email": emails[0] if emails else None  # Show first email for debugging
        }
        
    except Exception as e:
        return {"success": False, "error": str(e), "message": "Check Gmail credentials and try signing in again"}

@router.get("/emails/embeddings/search")
async def search_email_embeddings(
    query: str = Query(..., description="Natural language search query"),
    user_id: str = Query(..., description="User ID"),
    top_k: int = Query(default=5, description="Number of results to return")
):
    """Search emails using natural language query"""
    try:
        results = await email_service.search_emails(query, user_id, top_k)
        print("DEBUG: results =", results)
        
        return {
            "success": True,
            "query": query,
            "results": results,
            "count": len(results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email search failed: {str(e)}")

@router.get("/emails/embeddings/stats")
async def get_email_embedding_stats(user_id: str = Query(...)):
    """Get statistics about stored email embeddings"""
    try:
        stats = await email_service.get_email_stats(user_id)
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get email stats: {str(e)}")

@router.post("/emails/embeddings/sync")
async def sync_email_embeddings(user_id: str = Query(...)):
    """Sync latest emails to embeddings (incremental update)"""
    try:
        # Get recent emails (last 20)
        recent_emails = await email_service.get_emails(user_id, query="", max_results=20)
        
        if recent_emails:
            results = await email_service.store_email_embeddings(user_id, 20)
            return {
                "success": True,
                "message": "Email embeddings synced",
                "results": results
            }
        else:
            return {
                "success": True,
                "message": "No new emails to sync",
                "results": {"success": 0, "failed": 0}
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email sync failed: {str(e)}")


# Chat & AI Endpoints

@router.post("/chat/ask")
async def ask_question(request: Request):
    """Ask a question about any content and get an AI-generated answer"""
    try:
        data = await request.json()
        user_id = data.get("user_id", "")
        question = data.get("question", "")
        content_type = data.get("content_type", "all")
        max_context_items = data.get("max_context_items", 5)
        
        if not user_id or not question:
            return {"success": False, "error": "Missing required fields: user_id, question"}
        
        result = await chat_service.ask_question(
            user_id=user_id,
            question=question,
            content_type=content_type,
            max_context_items=max_context_items
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# Email Sync Endpoints

@router.post("/emails/sync")
async def sync_emails(request: Request):
    """Sync user emails to Supabase and Pinecone"""
    try:
        data = await request.json()
        user_id = data.get("user_id", "")
        max_emails = data.get("max_emails", 50)
        batch_size = data.get("batch_size", 10)
        
        if not user_id:
            return {"success": False, "error": "Missing required field: user_id"}
        
        result = await email_service.sync_emails_to_supabase(
            user_id=user_id,
            max_emails=max_emails,
            batch_size=batch_size
        )
        
        if result.get("success"):
            return {
                "success": True,
                "result": {
                    "new_emails_count": result.get("new_emails", 0),
                    "total_emails_count": result.get("total_emails", 0),
                    "indexed_emails_count": result.get("synced_to_supabase", 0),
                    "message": result.get("message", "Sync completed successfully")
                }
            }
        else:
            return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email sync failed: {str(e)}")


@router.get("/emails/sync/stats")
async def get_sync_stats(user_id: str = Query(...)):
    """Get email sync statistics for a user"""
    try:
        stats = await email_service.get_email_stats(user_id)
        
        # Transform stats to match frontend expectations
        if "error" not in stats:
            return {
                "success": True,
                "total_emails_count": stats.get("total_emails", 0),
                "new_emails_count": stats.get("unprocessed_emails", 0),
                "unprocessed_emails_count": stats.get("unprocessed_emails", 0),
                "last_sync_date": stats.get("last_sync")
            }
        else:
            return {
                "success": False,
                "error": stats.get("error", "Failed to get stats")
            }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get sync stats: {str(e)}")


@router.post("/emails/mark-processed")
async def mark_email_processed(request: Request):
    """Mark an email as processed"""
    try:
        data = await request.json()
        email_id = data.get("email_id", "")
        user_id = data.get("user_id", "")
        
        if not email_id or not user_id:
            return {"success": False, "error": "Missing required fields: email_id, user_id"}
        
        success = await email_service._mark_email_processed(email_id, user_id)
        
        return {
            "success": success,
            "email_id": email_id,
            "user_id": user_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark email as processed: {str(e)}")
