from abc import ABC, abstractmethod

class BaseAgent(ABC):
    @abstractmethod
    async def act(self, user_input: str, intent: str, entities: dict) -> dict:
        """Perform the agent's main action based on input, intent, and entities."""
        pass 