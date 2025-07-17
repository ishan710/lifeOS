from .langgraph_agent import LangGraphAgent
from .crewai_agent import CrewAIAgent

AGENT_CLASSES = {
    "langgraph": LangGraphAgent,
    "crewai": CrewAIAgent,
}

def get_agent(agent_type: str):
    agent_cls = AGENT_CLASSES.get(agent_type.lower(), LangGraphAgent)
    return agent_cls() 