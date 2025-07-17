from datetime import date
import datetime
import os
import json
import time
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from agentic_backend.config.settings import settings
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage
from langchain.output_parsers import PydanticOutputParser, OutputFixingParser
from langchain.prompts import PromptTemplate
import asyncio

# Pydantic models for structured output
class DiaryEntry(BaseModel):
    should_log: bool = Field(description="Whether this note should be logged as a diary entry")
    content: str = Field(description="The extracted diary content")
    mood: Optional[str] = Field(default=None, description="Detected mood if mentioned")
    tags: List[str] = Field(default_factory=list, description="Relevant tags for categorization")

class CalendarEvent(BaseModel):
    should_create: bool = Field(description="Whether a calendar event should be created")
    title: str = Field(description="Event title")
    description: str = Field(description="Event description")
    due_date: Optional[str] = Field(default=None, description="Due date in YYYY-MM-DD HH:MM format")

class Reminder(BaseModel):
    should_create: bool = Field(description="Whether a reminder should be created")
    title: str = Field(description="Reminder title")
    description: str = Field(description="Reminder description")
    due_date: Optional[str] = Field(default=None, description="Due date in YYYY-MM-DD HH:MM format")

class TaskExtractionResult(BaseModel):
    diary: DiaryEntry = Field(description="Diary entry information")
    calendar: CalendarEvent = Field(description="Calendar event information")
    reminder: Reminder = Field(description="Reminder information")

class IdeaRelationship(BaseModel):
    target_idea_id: int = Field(description="ID of the target idea")
    relationship_type: str = Field(description="Type of relationship: similar, opposes, builds_on, or contradicts")
    strength: float = Field(description="Relationship strength between 0.0 and 1.0")
    reasoning: str = Field(description="Brief explanation of the relationship")

class IdeaRelationshipList(BaseModel):
    relationships: List[IdeaRelationship] = Field(description="List of idea relationships")

class TaskExtractor:
    def __init__(self):
        self.openai_api_key = settings.openai_api_key
        os.environ["OPENAI_API_KEY"] = self.openai_api_key
        
        # Initialize LLM
        self.llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
        
        # Initialize parsers
        self.task_parser = PydanticOutputParser(pydantic_object=TaskExtractionResult)
        self.relationship_parser = PydanticOutputParser(pydantic_object=IdeaRelationshipList)
        
        # Create fixing parsers to handle malformed output
        self.fixing_task_parser = OutputFixingParser.from_llm(
            parser=self.task_parser, 
            llm=self.llm
        )
        self.fixing_relationship_parser = OutputFixingParser.from_llm(
            parser=self.relationship_parser, 
            llm=self.llm
        )

    async def extract_tasks(self, note_text: str, similar_notes: List[Dict] = []) -> Dict[str, Any]:
        print("DEBUG: Extracting tasks from note:", note_text[:100] + "...")
        
        # Build context from similar notes
        context = ""
        if similar_notes:
            context = "Similar previous notes:\n"
            for note in similar_notes[:3]:  # Limit to 3 similar notes
                context += f"- {note.get('text', '')}\n"
        
        # Create prompt template
        prompt_template = PromptTemplate(
            template="""
Analyze this note and extract actionable tasks. Consider the context from similar notes if provided.

Note to analyze: {note_text}

{context}

Guidelines:
- Set should_log/should_create to true only if the note contains actionable content
- Extract dates in YYYY-MM-DD HH:MM format or leave as null if no date is mentioned
- Today's date reference: {today_date}
- For diary entries, extract the core content and any mood indicators
- For calendar/reminders, extract specific events or tasks with deadlines
- Be conservative - only create tasks/entries when there's clear actionable content

{format_instructions}
""",
            input_variables=["note_text", "context", "today_date"],
            partial_variables={"format_instructions": self.task_parser.get_format_instructions()}
        )
        
        try:
            # Format the prompt
            formatted_prompt = prompt_template.format(
                note_text=note_text,
                context=context,
                today_date=datetime.date.today()
            )
            
            print("DEBUG: Sending prompt to LLM...")
            
            # Get LLM response
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.llm([HumanMessage(content=formatted_prompt)]).content
            )
            
            # Ensure response is a string
            response_str = str(response) if response else ""
            print("DEBUG: LLM raw response:", response_str[:200] + "...")
            
            # Parse with fixing parser
            try:
                parsed_result = self.fixing_task_parser.parse(response_str)
                print("DEBUG: Successfully parsed result")
                return parsed_result.dict()
            except Exception as parse_error:
                print("ERROR: Failed to parse even with fixing parser:", parse_error)
                print("Raw response:", response_str)
                # Return default structure
                return self._get_default_task_result()
                
        except Exception as e:
            print("ERROR: LLM call failed:", e)
            return self._get_default_task_result()

    async def find_idea_relationships(self, new_idea: str, existing_ideas: List[Dict]) -> List[Dict]:
        if not existing_ideas:
            return []
            
        print("DEBUG: Finding relationships for new idea:", new_idea[:100] + "...")
        
        # Create prompt template
        prompt_template = PromptTemplate(
            template="""
Analyze the relationship between this new idea and existing ideas. Only include relationships with strength > 0.3.

New idea: {new_idea}

Existing ideas:
{existing_ideas}

Return a list of relationships. Be selective - only include meaningful relationships.

{format_instructions}
""",
            input_variables=["new_idea", "existing_ideas"],
            partial_variables={"format_instructions": self.relationship_parser.get_format_instructions()}
        )
        
        try:
            # Format existing ideas for prompt
            ideas_text = json.dumps(
                [{"id": idea.get("id"), "content": idea.get('content', '')} 
                 for idea in existing_ideas[:5]], 
                indent=2
            )
            
            # Format the prompt
            formatted_prompt = prompt_template.format(
                new_idea=new_idea,
                existing_ideas=ideas_text
            )
            
            print("DEBUG: Sending relationship analysis to LLM...")
            
            # Get LLM response
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.llm([HumanMessage(content=formatted_prompt)]).content
            )
            
            # Ensure response is a string
            response_str = str(response) if response else ""
            print("DEBUG: Relationship analysis response:", response_str[:200] + "...")
            
            # Parse with fixing parser
            try:
                parsed_relationships = self.fixing_relationship_parser.parse(response_str)
                print("DEBUG: Successfully parsed relationships")
                return [rel.dict() for rel in parsed_relationships.relationships]
            except Exception as parse_error:
                print("ERROR: Failed to parse relationships:", parse_error)
                print("Raw response:", response_str)
                return []
                
        except Exception as e:
            print("ERROR: Relationship analysis failed:", e)
            return []

    def _get_default_task_result(self) -> Dict[str, Any]:
        """Return default task extraction result when parsing fails"""
        return {
            "diary": {
                "should_log": False, 
                "content": "", 
                "mood": None, 
                "tags": []
            },
            "calendar": {
                "should_create": False, 
                "title": "", 
                "description": "", 
                "due_date": None
            },
            "reminder": {
                "should_create": False, 
                "title": "", 
                "description": "", 
                "due_date": None
            }
        } 