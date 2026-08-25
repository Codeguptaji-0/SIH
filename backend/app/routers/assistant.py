from fastapi import APIRouter
from app.schemas.schemas import ChatMessageRequest, ChatMessageResponse
from app.ai.provider import get_ai_provider

router = APIRouter(prefix="/api/assistant", tags=["AI Virtual Assistant"])

@router.post("/chat", response_model=ChatMessageResponse)
def chat_with_assistant(request: ChatMessageRequest):
    ai_provider = get_ai_provider()
    reply = ai_provider.generate_chat_response(request.message)
    
    sources = [
        "MoSPI Statistical Manual 2025",
        "iGOT Karmayogi Course Directory",
        "NSSTA TPAC Training Guidelines"
    ]
    
    return ChatMessageResponse(reply=reply, sources=sources)
