import os
from pinecone import IndexEmbed, Pinecone, Vector, SearchQuery
import openai

class VectorStore:
    def __init__(self):
        self.pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        self.index_name = "lifeos-vectorstore"
        self.dense_index = self.pc.Index(self.index_name)

    def add_documents(self, documents):
        self.dense_index.upsert(vectors=documents)

    def get_embedding(self, text: str):
        openai.api_key = os.getenv("OPENAI_API_KEY")
        response = openai.embeddings.create(
            input=text,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding
    
    def search(self, embedding, top_k=5, user_name=None):
        # user_name filter is optional
        return self.dense_index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
            filter={"user": user_name} if user_name else None
        )