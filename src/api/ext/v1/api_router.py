from fastapi import APIRouter

from .endpoints import messages  # noqa


api_router = APIRouter()

api_router.include_router(messages.router, prefix='/messeges', tags=['Messages'])
