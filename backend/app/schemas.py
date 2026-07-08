from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class FormState(BaseModel):
    hcp_name: Optional[str] = ""
    interaction_type: Optional[str] = "Meeting"
    date: Optional[str] = ""
    time: Optional[str] = ""
    attendees: Optional[str] = ""
    topics_discussed: Optional[str] = ""
    materials_shared: List[str] = Field(default_factory=list)
    sentiment: Optional[str] = "Neutral"
    samples_distributed: Optional[str] = ""
    outcomes: Optional[str] = ""
    followup_actions: Optional[str] = ""

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    form_state: FormState
    chat_history: List[ChatMessage] = Field(default_factory=list)

class ToolLog(BaseModel):
    tool_name: str
    description: str
    parameters: Dict[str, Any]

class ChatResponse(BaseModel):
    reply: str
    form_state: FormState
    tool_logs: List[ToolLog] = Field(default_factory=list)
    hcp_history: List[Dict[str, Any]] = Field(default_factory=list)
    followup_email: Optional[str] = None
