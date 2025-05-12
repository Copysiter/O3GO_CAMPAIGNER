from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

import json
import time


class HttpLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/ext"):
            body = await request.body()

            log_data = {
                "method": request.method,
                "url": str(request.url),
                "headers": dict(request.headers),
                "body": body.decode(errors="ignore"),
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

            with open("log/httpdump.jsonl", "a", encoding="utf-8") as f:
                f.write(json.dumps(log_data, ensure_ascii=False) + "\n")

        response = await call_next(request)
        return response