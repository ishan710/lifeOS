from typing import Dict, List, Any
from agentic_backend.services.supabase_service import SupabaseService
from agentic_backend.services.task_extractor import TaskExtractor
from agentic_backend.vector_store import VectorStore

class NoteProcessor:
    def __init__(self):
        self.supabase_service = SupabaseService()
        self.task_extractor = TaskExtractor()
        self.vector_store = VectorStore()
    
    async def process_note(self, note_id: str, note_text: str, user_name: str):
        """Main processing workflow for a new note"""
        
        print("DEBUG: note_text =", note_text)

        # 1. Find similar notes using semantic search
        embedding = self.vector_store.get_embedding(note_text)
        similar_notes = self.vector_store.search(embedding=embedding)
        matches = similar_notes["matches"] 
        
        # 2. Extract tasks using LLM
        
        print("DEBUG: similar_notes_list =", matches)
        task_data = await self.task_extractor.extract_tasks(note_text, matches)
        print("DEBUG: task_data =", task_data)
        
        # 3. Create tasks based on extracted data
        created_tasks = []
        
        # Create calendar event if needed
        if task_data.get('calendar', {}).get('should_create'):
            calendar_task = task_data['calendar']
            await self.supabase_service.create_task(
                note_id=note_id,
                task_type='calendar',
                title=calendar_task.get('title', 'Calendar Event'),
                description=calendar_task.get('description'),
                due_date=calendar_task.get('due_date'),
                user_name=user_name
            )
            created_tasks.append('calendar')
        
        # Create reminder if needed
        if task_data.get('reminder', {}).get('should_create'):
            reminder_task = task_data['reminder']
            await self.supabase_service.create_task(
                note_id=note_id,
                task_type='reminder',
                title=reminder_task.get('title', 'Reminder'),
                description=reminder_task.get('description'),
                due_date=reminder_task.get('due_date'),
                user_name=user_name
            )
            created_tasks.append('reminder')
        
        # Create diary entry if needed
        if task_data.get('diary', {}).get('should_log'):
            diary_data = task_data['diary']
            diary_response = await self.supabase_service.create_diary_entry(
                note_id=note_id,
                content=diary_data.get('content', note_text),
                mood=diary_data.get('mood'),
                tags=diary_data.get('tags', []),
                user_name=user_name
            )
            
            # Find relationships with existing ideas
            if diary_response.data:
                new_idea_id = diary_response.data[0]['id']
                existing_ideas = await self.supabase_service.get_idea_graph_data(user_name)
                relationships = await self.task_extractor.find_idea_relationships(
                    diary_data.get('content', note_text),
                    existing_ideas.get('nodes', [])
                )
                
                # Create relationships
                for rel in relationships:
                    await self.supabase_service.create_idea_relationship(
                        source_idea_id=new_idea_id,
                        target_idea_id=rel['target_idea_id'],
                        relationship_type=rel['relationship_type'],
                        strength=rel['strength']
                    )
            
            created_tasks.append('diary')
        
        return {
            "note_id": note_id,
            "created_tasks": created_tasks,
            "task_data": task_data
        } 