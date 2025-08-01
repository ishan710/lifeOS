"""
Generic Chat Service
Allows users to ask questions about any content and get AI-generated answers.
"""

import logging
import os
from typing import List, Dict, Any, Optional
from agentic_backend.vector_store import VectorStore
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.prompts import ChatPromptTemplate

logger = logging.getLogger(__name__)


class ChatService:
    """Generic service for chatting about any content using AI"""
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.7
        )
        
    async def ask_question(self, user_id: str, question: str, content_type: str = "all", max_context_items: int = 5) -> Dict[str, Any]:
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
            relevant_items = await self._search_content(
                query=question,
                user_id=user_id,
                content_type=content_type,
                top_k=max_context_items
            )
            
            if not relevant_items:
                return {
                    "success": False,
                    "answer": f"I couldn't find any relevant {content_type} to answer your question. Please try rephrasing your question or check if you have content indexed.",
                    "context_items": [],
                    "question": question
                }
            
            # Step 2: Prepare context from relevant items
            context = self._prepare_context(relevant_items, content_type)
            
            # Step 3: Generate answer using LLM
            answer = await self._generate_answer(question, context, user_id, content_type)
            
            return {
                "success": True,
                "answer": answer,
                "context_items": relevant_items,
                "question": question,
                "context_used": len(relevant_items),
                "content_type": content_type
            }
            
        except Exception as e:
            logger.error(f"Error processing question for user {user_id}: {e}")
            return {
                "success": False,
                "answer": f"Sorry, I encountered an error while processing your question: {str(e)}",
                "context_items": [],
                "question": question
            }
    
    async def _search_content(self, query: str, user_id: str, content_type: str = "all", top_k: int = 5) -> List[Dict[str, Any]]:
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
                filter={"user_id": user_id}
            )
            
            # Process results
            items = []
            try:
                matches = search_results["matches"]
                for match in matches:
                        items.append({
                            "id": getattr(match, 'id', ''),
                            "content": match.metadata.get("content", ""),
                            "similarity_score": getattr(match, 'score', 0.0),
                            "metadata": match.metadata,
                            "user_id": match.metadata.get("user_id")
                        })
            except Exception as e:
                logger.warning(f"Error processing search results: {e}")
                items = []
            
            return items
            
        except Exception as e:
            logger.error(f"Failed to search content: {e}")
            return []
    
    def _prepare_context(self, items: List[Dict[str, Any]], content_type: str) -> str:
        """
        Prepare context from search results for the LLM.
        
        Args:
            items: List of relevant items from search
            content_type: Type of content being processed
            
        Returns:
            Formatted context string
        """
        context_parts = []
        
        for i, item in enumerate(items, 1):
            item_type = item.get('type', content_type)
            
            # Format based on content type
            if item_type == "email":
                context_block = f"""
Email {i}:
- Subject: {item.get('metadata', {}).get('subject', 'No subject')}
- From: {item.get('metadata', {}).get('from', 'Unknown sender')}
- Date: {item.get('metadata', {}).get('date', 'Unknown date')}
- Relevance Score: {item.get('similarity_score', 0):.2f}
- Content: {item.get('content', 'No content available')}
"""
            else:
                context_block = f"""
{item_type.title()} {i}:
- Type: {item_type}
- Relevance Score: {item.get('similarity_score', 0):.2f}
- Content: {item.get('content', 'No content available')}
"""
            context_parts.append(context_block)
        
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
            return f"I couldn't find any relevant {content_type} to answer your question. Please try rephrasing or check if you have content indexed."
        
        try:
            # Create system prompt with context
            system_prompt = f"""You are an AI assistant helping a user understand their {content_type}. 
You have access to relevant {content_type} context to answer their questions.

Guidelines:
1. Answer based ONLY on the provided {content_type} context
2. Be concise but informative
3. If the context doesn't contain enough information, say so
4. Reference specific {content_type} items when relevant
5. Be helpful and professional
6. Don't make up information not present in the context
7. Format your response in a clear, readable way

{content_type.title()} Context:
{context}

User Question: {question}

Please provide a helpful answer based on the {content_type} context above."""

            # Use LangChain to generate response
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=question)
            ]
            
            response = await self.llm.ainvoke(messages)
            
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