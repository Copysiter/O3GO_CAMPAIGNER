from fastapi import APIRouter

from .endpoints import messages, webhook  # noqa

api_router = APIRouter()

api_router.include_router(messages.router, prefix='/messeges', tags=['Messages'])
api_router.include_router(webhook.router, prefix='/webhook', tags=['Test Webhook'])
