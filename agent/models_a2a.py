from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

# --- A2A Request Models ---

class ChatHistoryItem(BaseModel):
    From: str = Field(..., description="Message sender: 'user' or 'agent'")
    Locale: Optional[str] = None
    Text: str
    Timestamp: Optional[str] = None

class MessagePart(BaseModel):
    kind: str
    text: str

class A2AMetadata(BaseModel):
    # Using Field alias to handle the special key with dots and slashes
    # Copilot Studio sometimes wraps this in {"HasValue": true, "Value": [...]}, so we use Any
    chathistory: Optional[Any] = Field(
        default=None, 
        alias="copilotstudio.microsoft.com/a2a/chathistory"
    )

    class Config:
        populate_by_name = True
        extra = 'allow'

class A2AMessageParamsMessage(BaseModel):
    contextId: str
    metadata: Optional[A2AMetadata] = None
    parts: Optional[List[MessagePart]] = None
    role: Optional[str] = None
    
    class Config:
        extra = 'allow'

class A2AMessageParams(BaseModel):
    message: A2AMessageParamsMessage

class A2ARequest(BaseModel):
    method: str = Field(..., description="E.g., 'message/send'")
    params: A2AMessageParams
    id: Optional[str] = None

# --- A2A Response Models ---

class A2AResponseResult(BaseModel):
    type: str = Field(..., description="Event type, e.g., 'MessageChunkEvent' or 'MessageCompleteEvent'")
    content: Optional[str] = None
    status: Optional[str] = None

class A2AResponse(BaseModel):
    jsonrpc: str = "2.0"
    id: str = "1" # Should match the original request id if provided
    result: A2AResponseResult
