from agentic_backend.agents.registry import get_agent
from agentic_backend.core.intent import recognize_intent
from agentic_backend.core.entities import extract_entities

async def handle_user_input(user_input: str, agent_type: str = "langgraph"):
    intent = await recognize_intent(user_input)
    entities = await extract_entities(user_input, intent)
    agent = get_agent(agent_type)
    result = await agent.act(user_input, intent, entities)
    return result 