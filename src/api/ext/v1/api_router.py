from fastapi import APIRouter

from .endpoints import messeges, messages, webhook, teleraptor, android  # noqa

api_router = APIRouter()

api_router.include_router(messeges.router, prefix='/messeges', tags=['Messages (OLD)'])
api_router.include_router(messages.router, prefix='/messages', tags=['Messages'])
api_router.include_router(webhook.router, prefix='/webhook', tags=['Test Webhook'])

api_router.include_router(teleraptor.router, prefix='/teleraptor/message', tags=['TeleRaptor'])

api_router.include_router(android.router, prefix='/android', tags=['Android'])