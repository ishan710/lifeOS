from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from agentic_backend.api.router import router

app = FastAPI(title="LifeOS API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router, prefix="/api")
# app.include_router(simple_gmail_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "LifeOS API is running!"}