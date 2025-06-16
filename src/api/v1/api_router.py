from fastapi import APIRouter

from .endpoints import (
    base, auth, users, tags, api_keys, campaigns,
    androids, upload, options, utils
)


api_router = APIRouter()

api_router.include_router(base.router, prefix='', tags=['Info'])
api_router.include_router(utils.router, prefix='/utils', tags=['Utils'])
api_router.include_router(auth.router, prefix='/auth', tags=['Auth'])
api_router.include_router(users.router, prefix='/users', tags=['Users'])
api_router.include_router(tags.router, prefix='/tags', tags=['Tags'])  # noqa
api_router.include_router(api_keys.router, prefix='/api_keys', tags=['ApiKeys'])
api_router.include_router(campaigns.router, prefix='/campaigns', tags=['Campaigns'])  # noqa
api_router.include_router(androids.router, prefix='/androids', tags=['Android Devices'])
api_router.include_router(upload.router, prefix='/upload', tags=["Upload"])
api_router.include_router(options.router, prefix='/options', tags=['Options'])
