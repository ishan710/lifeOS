"""
Enhanced Text Chunking Service
Uses LangChain for intelligent email chunking with advanced parsing and analysis.
"""

import hashlib
import logging
import re
import string
import json
from typing import List, Dict, Any, Optional

from gotrue import BaseModel
from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic.fields import Field

from agentic_backend.types.schema import Chunk

from langchain_openai import ChatOpenAI
from langchain.schema import SystemMessage, HumanMessage

logger = logging.getLogger(__name__)


class TextChunkingService:
    """Service for chunking text into logical pieces with LangChain analysis"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.1)

    async def summarize_chunk_text(self, email_text: str):
        """
        Use LangChain to analyze and create intelligent chunks from email text.
        """
        class ChunkAnalysis(BaseModel):
            chunk_text: str = Field(description="Summarized or extracted text content for this chunk")
            is_promotional: bool = Field(description="Whether this chunk contains promotional content")
            timeline: str = Field(description="Any timelines, dates, or deadlines mentioned")
            action_items: List[str] = Field(description="Action items, tasks, or to-dos mentioned")
            tags: List[str] = Field(description="Categorization tags (e.g., meeting, task, update, notification)")
            importance_score: int = Field(description="Importance score from 1-10", ge=1, le=10)
            chunk_type: str = Field(description="Type of chunk: summary, action_items, key_info, content, promotional")

        class ChunkAnalysisBlocks(BaseModel):
            chunks: List[ChunkAnalysis] = Field(description="List of analyzed text chunks")

        # Enhanced prompt for better analysis
        system_prompt = """You are an expert email analyzer and content chunker. Your task is to break down email content into meaningful, searchable chunks that extract the most valuable information.

ANALYSIS GUIDELINES:
1. **Content Classification**: Determine if content is valuable (work/personal) or promotional
2. **Information Extraction**: Focus on actionable items, deadlines, key decisions, and important context
3. **Chunk Types**:
   - summary: Key points and context
   - action_items: Tasks, to-dos, and required actions
   - key_info: Important dates, people, decisions, or critical information
   - content: Additional relevant content
   - promotional: Marketing or spam content (minimize these)

4. **Quality Standards**:
   - Each chunk should be focused and contain valuable, searchable information
   - Avoid redundant or low-value content
   - Preserve important context and relationships
   - Extract specific details like dates, names, and action items

5. **Chunking Strategy**:
   - Create 2-4 chunks per email
   - Each chunk should be 50-200 words
   - Focus on extracting the most important information
   - Ensure chunks are self-contained and meaningful

{format_instructions}"""

        human_prompt = """Analyze this email content and create intelligent chunks:

EMAIL CONTENT:
{email_text}

Create chunks that:
- Extract the most valuable and actionable information
- Identify key dates, people, and decisions
- Separate promotional content from important content
- Provide clear, searchable summaries
- Focus on user-relevant information"""

        try:
            # Create the prompt template
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("human", human_prompt)
            ])
            
            # Format the prompt
            formatted_prompt = prompt.format_messages(
                format_instructions=self._get_format_instructions(ChunkAnalysisBlocks),
                email_text=email_text[:3000]  # Limit content length
            )
            
            # Get response from LLM
            response = await self.llm.ainvoke(formatted_prompt)
            
            # Parse the response
            parser = PydanticOutputParser(pydantic_object=ChunkAnalysisBlocks)
            analysis = parser.parse(str(response.content))
            
            logger.info(f"Successfully analyzed email into {len(analysis.chunks)} chunks")
            return analysis
            
        except Exception as e:
            logger.error(f"Error in chunk analysis: {e}")
            # Fallback: create a simple summary chunk
            fallback_chunk = ChunkAnalysis(
                chunk_text=email_text[:500] + "..." if len(email_text) > 500 else email_text,
                is_promotional=False,
                timeline="",
                action_items=[],
                tags=["fallback", "summary"],
                importance_score=5,
                chunk_type="fallback_summary"
            )
            return ChunkAnalysisBlocks(chunks=[fallback_chunk])

    def _get_format_instructions(self, pydantic_object):
        """Get format instructions for the parser"""
        try:
            parser = PydanticOutputParser(pydantic_object=pydantic_object)
            return parser.get_format_instructions()
        except Exception as e:
            logger.error(f"Error getting format instructions: {e}")
            return "Return a valid JSON object with the required fields."

    async def chunk_text(self, text: str, max_chunk_size: int = 1000, overlap: int = 100, email_id: str = "") -> List[Chunk]:
        """
        Split text into intelligent chunks using LangChain analysis.
        
        Args:
            text: Text to chunk
            max_chunk_size: Maximum words per chunk (not used in LangChain mode)
            overlap: Number of words to overlap (not used in LangChain mode)
            email_id: Email ID to associate with chunks
            
        Returns:
            List of intelligent chunks with extracted valuable information
        """
        if not text.strip():
            return []
        
        # Clean the text
        text = self._clean_text(text)
        
        # Use LangChain to create intelligent chunks
        chunks_analysis = await self.summarize_chunk_text(text)
        
        # Convert analysis to Chunk objects
        chunks: List[Chunk] = []
        for i, chunk_analysis in enumerate(chunks_analysis.chunks):
            # Create unique chunk ID
            chunk_id = hashlib.sha256(f"{chunk_analysis.chunk_text}_{i}".encode()).hexdigest()
            
            # Create chunk with all required fields
            chunk = Chunk(
                chunk_type=chunk_analysis.chunk_type,
                chunk_id=chunk_id,
                chunk_text=chunk_analysis.chunk_text,
                email_id=email_id,
                type="email_chunk"
            )
            chunks.append(chunk)
            
            logger.info(f"Created chunk {i+1}: {chunk_analysis.chunk_type} (importance: {chunk_analysis.importance_score})")

        return chunks

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text."""
        if not text:
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove excessive line breaks
        text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
        # Remove URLs
        text = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        # Remove any remaining URLs that may start with www.
        text = re.sub(r'www\.(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', text)
        # Remove email addresses
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', text)
        # Remove phone numbers
        text = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '', text)
        # Remove excessive punctuation
        text = re.sub(r'[!]{2,}', '!', text)
        text = re.sub(r'[?]{2,}', '?', text)
        text = re.sub(r'[.]{2,}', '.', text)
        
        return text.strip()
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using regex."""
        # Split on sentence endings followed by space or end of string
        sentences = re.split(r'(?<=[.!?])\s+', text)
        # Filter out empty sentences
        return [s.strip() for s in sentences if s.strip()] 