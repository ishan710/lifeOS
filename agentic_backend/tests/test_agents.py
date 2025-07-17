# import pytest
# import asyncio
# from agentic_backend.agents.registry import get_agent

# @pytest.mark.asyncio
# async def test_langgraph_agent():
#     agent = get_agent("langgraph")
#     result = await agent.act("test input", "note", {})
#     assert result["agent"] == "LangGraphAgent"

# @pytest.mark.asyncio
# async def test_crewai_agent():
#     agent = get_agent("crewai")
#     result = await agent.act("test input", "note", {})
#     assert result["agent"] == "CrewAIAgent" 