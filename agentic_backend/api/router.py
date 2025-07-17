from fastapi import APIRouter, Request
from agentic_backend.core.orchestrator import handle_user_input
from agentic_backend.vector_store import VectorStore
from agentic_backend.services.supabase_service import SupabaseService
from agentic_backend.services.note_processor import NoteProcessor
from pinecone import Pinecone, ServerlessSpec
import os
import uuid

router = APIRouter()
vector_store = VectorStore()
supabase_service = SupabaseService()
note_processor = NoteProcessor()

@router.post("/agent/act")
async def agent_act(request: Request):
    data = await request.json()
    user_input = data.get("input", "")
    agent_type = data.get("agent_type", "langgraph")
    result = await handle_user_input(user_input, agent_type)
    return result

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
        "metadata": {"text": note_text, "user": user_name}
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

@router.get("/ideas/graph")
async def get_idea_graph(user_name: str):
    """Get idea graph data for visualization"""
    graph_data = await supabase_service.get_idea_graph_data(user_name)
    return {"graph": graph_data}

@router.get("/notes/similar/{note_id}")
async def get_similar_notes(note_id: str, user_name: str):
    """Get semantically similar notes"""
    # Get the note first
    note_response = await supabase_service.find_similar_notes([], user_name, limit=1)
    if note_response.data:
        note = note_response.data[0]
        embedding = note.get('embedding', [])
        similar_notes = await supabase_service.find_similar_notes(embedding, user_name, limit=5)
        return {"similar_notes": similar_notes.data if similar_notes.data else []}
    return {"similar_notes": []}
