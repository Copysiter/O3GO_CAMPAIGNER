from typing import Any, List  # noqa

from fastapi import APIRouter, Depends, HTTPException, status  # noqa
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa
from tasks import webhook_handler
import crud, models, schemas  # noqa

import time

router = APIRouter()


@router.get('/', response_model=schemas.WebhookResponse)
async def webhook(
    data: schemas.WebhookRequest = Depends(),
    _=Depends(deps.check_api_key)
) -> Any:
    r = webhook_handler.delay(data.model_dump())
    return {'task_id': r.task_id}
