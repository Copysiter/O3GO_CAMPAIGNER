import json
import random
import string

from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

import models, schemas, crud

from api import deps

from .messages import get_next, set_status


def generate_auth_code(length=6):
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choices(characters, k=length))


router = APIRouter()


@router.post(
    '/reg',
    response_model=schemas.AndroidRegResponse,
    status_code=status.HTTP_201_CREATED
)
async def reg_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AndroidCreate = \
            Depends(deps.as_form(schemas.AndroidCreate)),
    user = Depends(deps.get_user_by_api_key),
) -> Any:
    """
    Register new Device.
    """
    db_obj = await crud.android.get_by(db=db, device=obj_in.device)
    auth_code = ""
    if not db_obj:
        obj_in.user_id = user.id
        auth_code = obj_in.auth_code = generate_auth_code()
        db_obj = await crud.android.create(db=db, obj_in=obj_in)
    return schemas.AndroidRegResponse(
        auth_code=auth_code, id_device=db_obj.id
    )


@router.post(
    '/power',
    response_model=schemas.AndroidCodeResponse,
    status_code=status.HTTP_201_CREATED
)
async def power_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AndroidPowerRequest = \
            Depends(deps.as_form(schemas.AndroidPowerRequest)),
    _ = Depends(deps.get_user_by_api_key),
) -> Any:
    """
    Power Device.
    """
    db_obj = await crud.android.get_by(db=db, device=obj_in.device)
    if not db_obj:
        raise HTTPException(
            status_code=404, detail='Android Device not found'
        )
    _ = await crud.android.update(
        db=db, db_obj=db_obj, obj_in={
            'is_active': bool(obj_in.power)
        }
    )
    return schemas.AndroidCodeResponse(code='0')


@router.post(
    '/messages',
    response_model=schemas.AndroidMessageResponse,
    status_code=status.HTTP_201_CREATED
)
async def get_messages(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AndroidMessageRequest = \
            Depends(deps.as_form(schemas.AndroidMessageRequest)),
    user = Depends(deps.get_user_by_api_key),
) -> Any:
    """
    Get Messages.
    """
    db_obj = await crud.android.get_by(db=db, device=obj_in.device)
    if not db_obj:
        raise HTTPException(
            status_code=404, detail='Android Device not found'
        )
    try:
        message = await get_next(
            session=db, user=user, api_key=db_obj.device, status='waiting'
        )
        return schemas.AndroidMessageResponse(
            **db_obj.to_dict(),
            data=[{
                'id': message.get('id'),
                'phone': message.get('phone'),
                'msg': message.get('text')
            }]
        )
    except HTTPException:
        return schemas.AndroidMessageResponse(data=[])


@router.post(
    '/message/confirm',
    response_model=schemas.AndroidCodeResponse,
    status_code=status.HTTP_201_CREATED
)
async def confirm_message(
    *,
    db: AsyncSession = Depends(deps.get_db),
    # obj_in: schemas.AndroidMessageWebhook = \
    #         Depends(deps.as_form(schemas.AndroidMessageWebhook)),
    device: str = Form(...),
    param_json: str = Form(...),
    _ = Depends(deps.get_user_by_api_key),
) -> Any:
    """
    Confirm message receive.
    """
    for obj in json.loads(param_json):
        campaign_dst = \
            await crud.campaign_dst.get(db=db, id=obj.get('id'))
        if not campaign_dst:
            raise HTTPException(
                status_code=404, detail='Message not found'
            )
        _ = await crud.campaign_dst.update(
            db=db, db_obj=campaign_dst, obj_in={
                'status': schemas.CampaignDstStatus.SENT,
                'sent_ts': datetime.utcnow()
            }
        )
    return schemas.AndroidCodeResponse(code='0')


@router.post(
    '/message/status',
    response_model=schemas.AndroidCodeResponse,
    status_code=status.HTTP_201_CREATED
)
async def set_message_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    # obj_in: schemas.AndroidMessageWebhook = \
    #         Depends(deps.as_form(schemas.AndroidMessageWebhook)),
    device: str = Form(...),
    param_json: str = Form(...),
    user = Depends(deps.get_user_by_api_key),
) -> Any:
    """
    Confirm message receive.
    """
    for obj in json.loads(param_json):
        campaign_dst = \
            await crud.campaign_dst.get(db=db, id=obj.get('id'))
        if not campaign_dst:
            raise HTTPException(
                status_code=404, detail='Message not found'
            )
        status = 'delivered' if obj.get('is_deliv') == 1 else 'undelivered'
        _ = await set_status(
            session=db, user=user, id=campaign_dst.id, status=status
        )
    return schemas.AndroidCodeResponse(code='0')
