import os
import json
import time

from pathlib import Path
from fastapi import APIRouter, Request, Response

from .endpoints import messeges, messages, webhook  # noqa



class LoggingRoute(APIRoute):
    def get_route_handler(self):
        original_handler = super().get_route_handler()

        async def custom_route_handler(request: Request):
            body = await request.body()

            log_data = {
                "method": request.method,
                "url": str(request.url),
                "headers": dict(request.headers),
                "body": body.decode(errors="ignore"),
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

            # Абсолютный путь к /log/requests_dump.jsonl относительно корня проекта
            log_dir = Path(__file__).resolve().parents[3] / "log"
            log_dir.mkdir(exist_ok=True)
            log_file = log_dir / "requests_dump.jsonl"

            with log_file.open("a", encoding="utf-8") as f:
                f.write(json.dumps(log_data, ensure_ascii=False) + "\n")

            response: Response = await original_handler(request)
            return response

        return custom_route_handler

api_router = APIRouter(route_claass=LoggingRoute)

api_router.include_router(messeges.router, prefix='/messeges', tags=['Messages (OLD)'])
api_router.include_router(messages.router, prefix='/messages', tags=['Messages'])
api_router.include_router(webhook.router, prefix='/webhook', tags=['Test Webhook'])
