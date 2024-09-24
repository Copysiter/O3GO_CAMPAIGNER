from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from utils.statsd import StatsClient  # noqa

from logging import getLogger
from logging import Logger
from typing import Optional, Awaitable  # noqa


class StatsMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        prefix: str = '',
        host: str, port: int,
        block_urls: Optional[list],
        logger: Optional[Logger] = None
    ) -> None:
        super().__init__(app)
        self.logger = getLogger(__name__) if logger is None else logger
        self.app = app
        self.statsd: StatsClient = None
        self.host: str = host
        self.port: int = port
        self.prefix = prefix
        self.block_urls = block_urls

    async def dispatch(self, request: Request, call_next: Awaitable) -> None:
        self.statsd = await StatsClient(
            host=self.host, port=self.port, prefix=self.prefix
        )
        if request.url.path in self.block_urls:
            return await call_next(request)
        timer = self.statsd.timer()
        timer.start()
        response = await call_next(request)
        method = request.method.lower()
        path = request.scope.get('path').strip('/').replace('/', '_')
        status = f'{str(response.status_code)[0]}xx'
        key = f'{path}.{method}.{status}'
        await timer.stop(key)
        await self.statsd.incr(key)

        return response
