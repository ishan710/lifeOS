# import os
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str = ""
    tavily_api_key: str = ""
    pinecone_api_key: str = ""
    anthropic_api_key: str = ""
    default_agent: str = "langgraph"
    supabase_url: str = ""
    supabase_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()

