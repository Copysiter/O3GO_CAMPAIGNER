from fastapi import APIRouter

from .endpoints import (base, auth, users, connections, api_keys,
                        campaigns, campaigner, upload, options, utils)  # noqa


api_router = APIRouter()

api_router.include_router(base.router, prefix='', tags=['Info'])
api_router.include_router(utils.router, prefix='/utils', tags=['Utils'])
api_router.include_router(auth.router, prefix='/auth', tags=['Auth'])
api_router.include_router(users.router, prefix='/users', tags=['Users'])
api_router.include_router(connections.router, prefix='/connections', tags=['Connections'])  # noqa
api_router.include_router(api_keys.router, prefix='/api_keys', tags=['ApiKeys'])
api_router.include_router(campaigner.router, prefix='/campaigner', tags=['Campaigner'])  # noqa
api_router.include_router(campaigns.router, prefix='/campaigns', tags=['Campaigns'])  # noqa
api_router.include_router(upload.router, prefix='/upload', tags=["Upload"])
api_router.include_router(options.router, prefix='/options', tags=['Options'])
