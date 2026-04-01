from fastapi import APIRouter

from .endpoints import messeges, messages, webhook, teleraptor, android, account, links, hs  # noqa

api_router = APIRouter()

api_router.include_router(messeges.router, prefix="/messeges", tags=["Messages (OLD)"])
api_router.include_router(messages.router, prefix="/messages", tags=["Messages"])
api_router.include_router(webhook.router, prefix="/webhook", tags=["Test Webhook"])

api_router.include_router(
    teleraptor.router, prefix="/teleraptor/message", tags=["TeleRaptor"]
)

api_router.include_router(android.router, prefix="/android", tags=["Android"])
api_router.include_router(account.router, prefix="/account", tags=["Account"])
api_router.include_router(links.router, prefix="/links", tags=["Links"])
api_router.include_router(hs.router, prefix="/hs", tags=["HS Phone Checker"])
