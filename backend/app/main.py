import os
from fastapi import FastAPI, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from .database import init_db, SessionLocal, HCPInteraction, FollowUpTask
from .schemas import ChatRequest, ChatResponse
from .agent import run_agent_workflow

app = FastAPI(title="AI-First CRM HCP Module Backend")

# Enable CORS for frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def on_startup():
    # Initialize SQL database tables (SQLite)
    init_db()

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, x_groq_api_key: str = Header(default="")):
    print("\n>>> [main.py] RECEIVED REQUEST AT /api/chat! <<<", flush=True)
    print(f"Message: {request.message}", flush=True)
    
    # Run the LangGraph agent workflow
    # Pass along the API key from headers (or env if present)
    result = await run_agent_workflow(
        message=request.message,
        current_form_state=request.form_state.dict(),
        chat_history=[msg.dict() for msg in request.chat_history],
        api_key=x_groq_api_key
    )
    print(">>> [main.py] FINISHED REQUEST AT /api/chat! <<<", flush=True)
    return result

@app.get("/api/history")
def history_endpoint(db: Session = Depends(get_db)):
    """
    Returns all logged interactions stored in the database for auditing.
    """
    interactions = db.query(HCPInteraction).order_by(HCPInteraction.created_at.desc()).all()
    tasks = db.query(FollowUpTask).order_by(FollowUpTask.created_at.desc()).all()
    
    return {
        "interactions": [
            {
                "id": i.id,
                "hcp_name": i.hcp_name,
                "interaction_type": i.interaction_type,
                "date": i.date,
                "time": i.time,
                "attendees": i.attendees,
                "topics_discussed": i.topics_discussed,
                "materials_shared": [m.strip() for m in i.materials_shared.split(",") if m.strip()] if i.materials_shared else [],
                "sentiment": i.sentiment,
                "created_at": i.created_at
            }
            for i in interactions
        ],
        "tasks": [
            {
                "id": t.id,
                "hcp_name": t.hcp_name,
                "task_description": t.task_description,
                "due_date": t.due_date,
                "status": t.status,
                "created_at": t.created_at
            }
            for t in tasks
        ]
    }

@app.post("/api/reset")
def reset_db_endpoint(db: Session = Depends(get_db)):
    """
    Clears current tables for a fresh demonstration environment.
    """
    try:
        db.query(HCPInteraction).delete()
        db.query(FollowUpTask).delete()
        db.commit()
        return {"status": "success", "message": "Database successfully reset."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

