from supabase import create_client, Client
from agentic_backend.config.settings import settings
from typing import List, Dict, Any, Optional

class SupabaseService:
    def __init__(self):
        self.supabase: Client = create_client(
            settings.supabase_url, 
            settings.supabase_key
        )
    
    async def store_note(self, note_id: str, text: str, user_name: str, embedding: List[float]):
        """Store a note in Supabase with its embedding"""
        return self.supabase.table("notes").insert({
            "id": note_id,
            "text": text,
            "user_name": user_name,
            "embedding": embedding
        }).execute()
    
    async def create_task(self, note_id: str, task_type: str, title: str, description: str = None, due_date: str = None, user_name: str = None):
        """Create a new task"""
        return self.supabase.table("tasks").insert({
            "note_id": note_id,
            "task_type": task_type,
            "title": title,
            "description": description,
            "due_date": due_date,
            "user_name": user_name
        }).execute()
    
    async def get_user_tasks(self, user_name: str):
        """Get all tasks for a user"""
        return self.supabase.table("tasks").select("*").eq("user_name", user_name).order("created_at", desc=True).execute()
    
    async def complete_task(self, task_id: int):
        """Mark a task as completed"""
        return self.supabase.table("tasks").update({"status": "completed"}).eq("id", task_id).execute()
    
    async def create_diary_entry(self, note_id: str, content: str, mood: str = None, tags: List[str] = None, user_name: str = None):
        """Create a diary entry"""
        return self.supabase.table("diary_entries").insert({
            "note_id": note_id,
            "content": content,
            "mood": mood,
            "tags": tags or [],
            "user_name": user_name
        }).execute()
    
    async def create_idea_relationship(self, source_idea_id: int, target_idea_id: int, relationship_type: str, strength: float = 0.5):
        """Create a relationship between two ideas"""
        return self.supabase.table("idea_relationships").insert({
            "source_idea_id": source_idea_id,
            "target_idea_id": target_idea_id,
            "relationship_type": relationship_type,
            "strength": strength
        }).execute()
    
    async def get_idea_graph_data(self, user_name: str):
        """Get data for idea graph visualization"""
        # Get diary entries (nodes)
        diary_response = self.supabase.table("diary_entries").select("*").eq("user_name", user_name).execute()
        
        # Get relationships (edges)
        relationships_response = self.supabase.table("idea_relationships").select("*").execute()
        
        return {
            "nodes": diary_response.data,
            "edges": relationships_response.data
        }
    
    async def find_similar_notes(self, embedding: List[float], user_name: str, limit: int = 5):
        """Find similar notes using vector similarity"""
        # This would use Supabase's vector similarity search
        # For now, return a placeholder
        return self.supabase.table("notes").select("*").eq("user_name", user_name).limit(limit).execute() 