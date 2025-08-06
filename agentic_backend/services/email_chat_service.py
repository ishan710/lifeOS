"""
Generic Chat Service
Allows users to ask questions about any content and get AI-generated answers.
"""

import logging
import os
from typing import List, Dict, Any, Optional
from agentic_backend.types.schema import Chunk, Email
from agentic_backend.vector_store import VectorStore
from agentic_backend.services.supabase_service import SupabaseService
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)


class ChatService:
    """Generic service for chatting about any content using AI"""
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.supabase = SupabaseService()
        self.llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.1,
        )
        
    async def ask_question(self, user_id: str, question: str, content_type: str = "all", max_context_items: int = 25) -> Dict[str, Any]:
        """
        Ask a question about any content and get an AI-generated answer.
        
        Args:
            user_id: User asking the question
            question: The question to ask
            content_type: Type of content to search (emails, documents, notes, etc.) or "all"
            max_context_items: Maximum number of relevant items to use as context
            
        Returns:
            Dictionary containing the answer and context information
        """
        try:
            logger.info(f"Processing question for user {user_id}: {question}")
            
            # Step 1: Search for relevant content
            chunks_context = await self.get_chunks_by_query(
                query=question,
                user_id=user_id,
                content_type=content_type,
                top_k=max_context_items
            )
            
            if not chunks_context:
                return {
                    "success": False,
                    "answer": f"I couldn't find any relevant {content_type} to answer your question. Please try rephrasing your question or check if you have content indexed.",
                    "context_items": [],
                    "question": question
                }
            
            # Step 2: Prepare context from relevant items
            context = self._prepare_context(chunks_context, content_type)
            # Step 3: Generate answer using LLM
            answer = await self._generate_answer(question, context, user_id, content_type)
            
            return {
                "success": True,
                "answer": answer,
                "context_items": chunks_context,
                "question": question,
                "context_used": len(chunks_context),
                "content_type": content_type
            }
            
        except Exception as e:
            print("DEBUG: error =", e)
            return {
                "success": False,
                "answer": f"Sorry, I encountered an error while processing your question: {str(e)}",
                "context_items": [],
                "question": question
            }
    
    async def get_chunks_by_query(self, query: str, user_id: str, content_type: str = "all", top_k: int = 5) -> List[Chunk]:
        """
        Search for relevant content in the vector store.
        
        Args:
            query: Search query
            user_id: User ID
            content_type: Type of content to search for
            top_k: Number of results to return
            
        Returns:
            List of relevant content items
        """
        try:
            # Generate embedding for search query
            query_embedding = self.vector_store.get_embedding(query)
            # Search in Pinecone with user filter
            search_results = self.vector_store.search(
                embedding=query_embedding,
                top_k=top_k,
                # TODO: add user_id filter
                # filter={"user_id": user_id}
            )
            # Process results
            items = []
            try:
                matches = search_results["matches"]
                chunks = [Chunk(**match["metadata"]) for match in matches]
                return chunks
            except Exception as e:
                print("DEBUG: error =", e)
                logger.warning(f"Error processing search results: {e}")
                items = []
            
            return items
            
        except Exception as e:
            print("DEBUG: error =", e)
            logger.error(f"Failed to search content: {e}")
            return []

    async def _get_emails(self, email_ids: List[str]) -> List[Email]:
        """
        Get emails for a user.
        """
        search_results = await self.supabase.get_emails_by_ids(email_ids)
        return [Email(**email) for email in search_results]

    def _prepare_context(self, items: List[Chunk], content_type: str) -> str:
        """
        Prepare context from search results for the LLM.
        
        Args:
            items: List of relevant items from search
            content_type: Type of content being processed
            
        Returns:
            Formatted context string
        """
        context_parts = []
        for item in items:
            context_parts.append(item.chunk_text)
        return "\n".join(context_parts)
    
    async def _generate_answer(self, question: str, context: str, user_id: str, content_type: str) -> str:
        """
        Generate an answer using LangChain and OpenAI.
        
        Args:
            question: User's question
            context: Content context
            user_id: User ID for personalization
            content_type: Type of content being processed
            
        Returns:
            Generated answer
        """
        if not context.strip():
            return f"I couldn't find any relevant emails to answer your question. Please try rephrasing or check if you have content indexed."
        
        try:
            # Create system prompt with context
            system_prompt = f"""You are an AI assistant helping a user understand their emails. 
You have access to relevant emails to answer their questions.

Emails Context:
{context}

User Question: {question}

Please provide a helpful answer based on the {content_type} context above."""

            # Use LangChain to generate response
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=question)
            ]
            
            response = await self.llm.ainvoke(messages)

            # print("response", response)
            return str(response.content)
            
        except Exception as e:
            logger.error(f"Error generating answer with LangChain: {e}")
            return f"Sorry, I encountered an error while generating an answer: {str(e)}"
    
    async def get_chat_history(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get chat history for a user (placeholder for future implementation).
        
        Args:
            user_id: User ID
            limit: Maximum number of chat entries to return
            
        Returns:
            List of chat history entries
        """
        # TODO: Implement chat history storage and retrieval
        return []
    
    async def save_chat_entry(self, user_id: str, question: str, answer: str, 
                            context_emails: List[Dict[str, Any]]) -> bool:
        """
        Save a chat entry for history (placeholder for future implementation).
        
        Args:
            user_id: User ID
            question: User's question
            answer: Generated answer
            context_emails: Emails used as context
            
        Returns:
            Success status
        """
        # TODO: Implement chat history storage
        logger.info(f"Chat entry for user {user_id}: Q: {question[:50]}... A: {answer[:50]}...")
        return True 