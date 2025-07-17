from datetime import date
import datetime
import os
import json
import time
from typing import Dict, List, Any
from agentic_backend.config.settings import settings
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage
import asyncio

class TaskExtractor:
    def __init__(self):
        self.openai_api_key = settings.openai_api_key

    async def extract_tasks(self, note_text: str, similar_notes: List[Dict] = []) -> Dict[str, Any]:
        os.environ["OPENAI_API_KEY"] = self.openai_api_key
        print("DEBUGG TASK", similar_notes)
        context = ""
        if similar_notes:
            context = "Similar previous notes:\n"
            for note in similar_notes[:3]:  # Limit to 3 similar notes
                context += f"- {note.get('text', '')}\n"
        prompt = f"""
        Analyze this note and extract actionable tasks. Return a JSON object with the following structure:
        {{
            "diary": {{
                "should_log": boolean,
                "content": "extracted diary content",
                "mood": "mood if mentioned",
                "tags": ["tag1", "tag2"]
            }},
            "calendar": {{
                "should_create": boolean,
                "title": "event title",
                "description": "event description", 
                "due_date": "YYYY-MM-DD HH:MM"
            }},
            "reminder": {{
                "should_create": boolean,
                "title": "reminder title",
                "description": "reminder description",
            }}
        }}
        Note to analyze: {note_text} {similar_notes}
        {context}
        Guidelines:
        - Set should_log/should_create to true only if the note contains actionable content
        - Extract dates in YYYY-MM-DD HH:MM format or null if no date is mentioned. 
            "YYYY-MM-DD HH:MM or null" is NOT A VALID RESPONSE
            like 2025-10-01 for refernce today's date is {datetime.date.today()}
        - For diary entries, extract the core content and any mood indicators
        - For calendar/reminders, extract specific events or tasks with deadlines
        - REPONSE SHOULD BE A VALID JSON. THIS IS VERY IMPORTNAT OTHERWISE THE WORLD WILL END
        - DO NOT INCLUDE BACK TICKS
        """
        try:
            llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm([HumanMessage(content=prompt)]).content
            )
            print("DEBUGG JSON", response)
            if isinstance(response, str):
                try:
                    parsed = json.loads(response)
                    return parsed
                except Exception as json_err:
                    print("ERROR: Could not parse LLM response as JSON:", json_err)
                    print("LLM raw response:", response)
            else:
                print("ERROR: LLM response is not a string:", type(response))
            return {
                "diary": {"should_log": False, "content": "", "mood": None, "tags": []},
                "calendar": {"should_create": False, "title": "", "description": "", "due_date": None},
                "reminder": {"should_create": False, "title": "", "description": "", "due_date": None}
            }
        except Exception as e:
            print("ERROR: LLM call failed:", e)
            return {
                "diary": {"should_log": False, "content": "", "mood": None, "tags": []},
                "calendar": {"should_create": False, "title": "", "description": "", "due_date": None},
                "reminder": {"should_create": False, "title": "", "description": "", "due_date": None}
            }

    async def find_idea_relationships(self, new_idea: str, existing_ideas: List[Dict]) -> List[Dict]:
        os.environ["OPENAI_API_KEY"] = self.openai_api_key
        if not existing_ideas:
            return []
        prompt = f"""
        Analyze the relationship between this new idea and existing ideas. Return a JSON array of relationships:
        New idea: {new_idea}
        Existing ideas:
        {json.dumps([idea.get('content', '') for idea in existing_ideas[:5]], indent=2)}
        Return format:
        [
            {{
                "target_idea_id": number,
                "relationship_type": "similar|opposes|builds_on|contradicts",
                "strength": 0.0-1.0,
                "reasoning": "brief explanation"
            }}
        ]
        """
        try:
            llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm([HumanMessage(content=prompt)]).content
            )
            if isinstance(response, str):
                try:
                    parsed = json.loads(response)
                    return parsed
                except Exception as json_err:
                    print("ERROR: Could not parse LLM response as JSON:", json_err)
                    print("LLM raw response:", response)
            else:
                print("ERROR: LLM response is not a string:", type(response))
            return []
        except Exception as e:
            print("ERROR: LLM call failed:", e)
            return [] 