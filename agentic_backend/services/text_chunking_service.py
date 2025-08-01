"""
Simple Text Chunking Service
Splits text into logical chunks for processing.
"""

import logging
import re
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class TextChunkingService:
    """Service for chunking text into logical pieces"""
    
    def __init__(self):
        pass
        
    def chunk_text(self, text: str, max_chunk_size: int = 1000, overlap: int = 100) -> List[Dict[str, Any]]:
        """
        Split text into logical chunks.
        
        Args:
            text: Text to chunk
            max_chunk_size: Maximum words per chunk
            overlap: Number of words to overlap between chunks
            
        Returns:
            List of chunk dictionaries with content and metadata
        """
        if not text.strip():
            return []
        
        # Clean the text
        text = self._clean_text(text)
        
        # Split into sentences first (more logical than word-based)
        sentences = self._split_into_sentences(text)
        
        chunks = []
        current_chunk = []
        current_word_count = 0
        
        for sentence in sentences:
            sentence_words = sentence.split()
            sentence_word_count = len(sentence_words)
            
            # If adding this sentence would exceed the limit
            if current_word_count + sentence_word_count > max_chunk_size and current_chunk:
                # Save current chunk
                chunk_text = " ".join(current_chunk)
                chunks.append({
                    "content": chunk_text,
                    "word_count": current_word_count,
                    "chunk_type": "sentence_based"
                })
                
                # Start new chunk with overlap
                if overlap > 0:
                    # Keep last few sentences for overlap
                    overlap_words = []
                    overlap_count = 0
                    for sent in reversed(current_chunk):
                        sent_words = sent.split()
                        if overlap_count + len(sent_words) <= overlap:
                            overlap_words.insert(0, sent)
                            overlap_count += len(sent_words)
                        else:
                            break
                    current_chunk = overlap_words
                    current_word_count = overlap_count
                else:
                    current_chunk = []
                    current_word_count = 0
            
            # Add sentence to current chunk
            current_chunk.append(sentence)
            current_word_count += sentence_word_count
        
        # Add the last chunk if it has content
        if current_chunk:
            chunk_text = " ".join(current_chunk)
            chunks.append({
                "content": chunk_text,
                "word_count": current_word_count,
                "chunk_type": "sentence_based"
            })
        
        return chunks
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text."""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove excessive line breaks
        text = re.sub(r'\n\s*\n\s*\n', '\n\n', text)
        return text.strip()
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """Split text into sentences using regex."""
        # Split on sentence endings followed by space or end of string
        sentences = re.split(r'(?<=[.!?])\s+', text)
        # Filter out empty sentences
        return [s.strip() for s in sentences if s.strip()] 