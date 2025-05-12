from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import json
import time


class HttpLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Считываем тело запроса (оно может быть доступно только один раз)
        body = await request.body()
        
        # Логируем входящий запрос
        logging.info(f"Request: {request.method} {request.url} | Headers: {dict(request.headers)} | Body: {body.decode()}")
        
        response = await call_next(request)
        
        # Логируем ответ
        process_time = time.time() - start_time
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk
        response = Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type
        )

        logging.info(f"Response: {response.status_code} | Time: {process_time:.3f}s | Body: {response_body.decode(errors='ignore')}")
        return response