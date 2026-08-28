from fastapi import APIRouter, Depends
from app.schemas.schemas import ChatMessageRequest, ChatMessageResponse
from app.ai.provider import get_ai_provider, describe_ai_provider
from app.auth.dependencies import require_role

router = APIRouter(prefix="/api/assistant", tags=["AI Virtual Assistant"])


@router.post("/chat", response_model=ChatMessageResponse)
def chat_with_assistant(
    request: ChatMessageRequest,
    user=Depends(require_role("OFFICIAL", "TRAINER", "ADMIN"))
):
    """
    Answer one assistant question.

    Two things changed here.

    `sources` used to be a hardcoded list - "MoSPI Statistical Manual 2025",
    "iGOT Karmayogi Course Directory", "NSSTA TPAC Training Guidelines" - attached
    to every reply regardless of what the model said or whether any document was
    consulted. Nothing in this path performs retrieval, so those three lines were a
    citation for work that never happened. They are gone. When document-grounded
    retrieval is added, `sources` should be filled from the chunks that were
    actually used, and only then.

    `engine` is new: it names the provider that produced the reply, so a
    deterministic fallback answer cannot be mistaken for a live model's answer.
    """
    ai_provider = get_ai_provider()
    reply = ai_provider.generate_chat_response(request.message)

    return ChatMessageResponse(
        reply=reply,
        sources=[],
        engine=describe_ai_provider(),
    )
