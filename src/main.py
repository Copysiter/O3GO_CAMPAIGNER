import uvicorn

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from core.logger import LOGGING   # noqa
from core.config import settings

from db.init_db import init_db
from api.v1.api_router import api_router
from api.ext.v1.api_router import api_router as ext_api_router

from middlewares.http import HttpLoggingMiddleware


def init_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        await init_db()
        yield
        pass

    app = FastAPI(
        title=settings.PROJECT_NAME,
        docs_url=f'{settings.API_VERSION_PREFIX}/docs',
        redoc_url=f'{settings.API_VERSION_PREFIX}/redoc',
        openapi_url=f'{settings.API_VERSION_PREFIX}/openapi.json',
        default_response_class=ORJSONResponse,
        lifespan=lifespan
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(HttpLoggingMiddleware)

    app.include_router(api_router, prefix=settings.API_VERSION_PREFIX)

    ext_api = FastAPI(
        title=settings.PROJECT_NAME,
        docs_url=f'{settings.EXT_API_VERSION_PREFIX}/docs',
        redoc_url=f'{settings.EXT_API_VERSION_PREFIX}/redoc',
        openapi_url=f'{settings.EXT_API_VERSION_PREFIX}/openapi.json',
        default_response_class=ORJSONResponse
    )

    ext_api.include_router(ext_api_router, prefix=settings.EXT_API_VERSION_PREFIX)

    app.mount('', ext_api)

    app.secret_key = settings.SECRET_KEY

    return app


app = init_app()


if __name__ == '__main__':
    uvicorn.run(
        'main:app',
        host=settings.PROJECT_HOST, port=settings.PROJECT_PORT,
        workers=settings.ASGI_WORKERS, log_config=LOGGING,
        access_log=True, reload=False
    )
