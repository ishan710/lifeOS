import os
from pinecone import IndexEmbed, Pinecone, Vector, SearchQuery
import openai
from typing import List
from agentic_backend.types.schema import EmailEmbedding

class VectorStore:
    def __init__(self):
        self.pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        self.index_name = "lifeos-vectorstore"
        self.dense_index = self.pc.Index(self.index_name)

    def add_documents(self, documents: List[EmailEmbedding]):
        self.dense_index.upsert(vectors=documents)

    def get_embedding(self, text: str):
        openai.api_key = os.getenv("OPENAI_API_KEY")
        response = openai.embeddings.create(
            input=text,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding
    
    def search(self, embedding, top_k=25, filter=None):
        # user_name filter is optional
        return self.dense_index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
            filter=filter
        )
    
    def delete_all_vectors(self):
        """Delete all vectors in the index"""
        try:
            # Delete all vectors
            self.dense_index.delete(delete_all=True)
            return True
        except Exception as e:
            print(f"Error deleting all vectors: {e}")
            return False
    
    def get_index_stats(self):
        """Get statistics about the index"""
        try:
            return self.dense_index.describe_index_stats()
        except Exception as e:
            print(f"Error getting index stats: {e}")
            return None