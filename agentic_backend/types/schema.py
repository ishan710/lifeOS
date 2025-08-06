from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional, Dict, Any


@dataclass
class Email:
    """Supabase email table schema"""
    email_id: str
    created_at: datetime
    email_timestamp: datetime
    user_email_id: Optional[str] = None
    content: Optional[str] = None
    sender: Optional[str] = None

@dataclass
class Chunk:
    """Supabase email_chunks table schema"""
    chunk_type: str
    chunk_id: str
    chunk_text: str
    email_id: str
    type: str

@dataclass
class EmailEmbedding:
    """Supabase email_chunk_embeddings table schema"""
    chunk: Chunk
    email_id: str
    embedding: list[float]

@dataclass
class ApiResponse:
    """API response schema"""
    success: bool
    message: str

@dataclass
class User:
    """Supabase user table schema"""
    id: str
    email: str
    user_name: str
    created_at: datetime


def dataclass_to_dict(obj: Any) -> Dict[str, Any]:
    """Convert a dataclass object to a dictionary with proper datetime handling."""
    if not hasattr(obj, '__dataclass_fields__'):
        raise ValueError("Object is not a dataclass")
    
    result = {}
    for field_name, field_value in asdict(obj).items():
        if isinstance(field_value, datetime):
            result[field_name] = field_value.isoformat()
        else:
            result[field_name] = field_value
    
    return result
    
