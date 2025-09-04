import json
import random
import string
import logging

from datetime import datetime
from typing import Any
from pathlib import Path
from urllib.parse import urljoin

from fastapi import (
    Request, APIRouter, Depends, Form, HTTPException, status
)
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

import models, schemas, crud
import services.message

from api import deps


def generate_auth_code(length=6):
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choices(characters, k=length))


UPLOAD_DIR = Path('upload/apk')
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()


@router.post(
    '/reg',
    response_model=schemas.AndroidRegResponse,
    status_code=status.HTTP_200_OK
)
async def reg_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AndroidCreate = \
            Depends(deps.as_form(schemas.AndroidCreate)),
    user = Depends(deps.get_user_by_api_key),
    request: Request
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
    version = await crud.version.get_last(db=db)
    response = schemas.AndroidRegResponse(
        auth_code=auth_code, id_device=db_obj.id
    )
    if version:
        response.version = version.id
        base = (
            request.headers.get("x-base-url") or str(request.base_url)
        ).strip()
        response.apk_url = urljoin(
            base if base.endswith('/') else base + '/',
            f'ext/api/v1/android/apk?x_api_key={user.ext_api_key}'
        )
    return response


@router.post(
    '/power',
    response_model=schemas.AndroidCodeResponse,
    status_code=status.HTTP_200_OK
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
    status_code=status.HTTP_200_OK
)
async def get_messages(
    *,
    session: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AndroidMessageRequest = \
            Depends(deps.as_form(schemas.AndroidMessageRequest)),
    user = Depends(deps.get_user_by_api_key),
) -> Any:
    """
    Get Messages.
    """
    now = datetime.utcnow()
    weekday = str(now.isoweekday())
    hour = now.hour
    try:
        db_obj = await crud.android.get_by(db=session, device=obj_in.device)
        if not db_obj:
            raise HTTPException(
                status_code=404, detail='Android Device not found'
            )
        message = await services.message.get_next_processing(
            session=session, user=user, api_key=db_obj.device,
            status=schemas.CampaignDstStatus.WAITING,
            now=now, weekday=weekday, hour=hour
        )
        return schemas.AndroidMessageResponse(
            **db_obj.to_dict(),
            data=[{
                'id': message.get('id'),
                'phone': message.get('phone'),
                'msg': message.get('text')
            }]
        )
    except Exception as e:
        print(type(e).__name__, e, sep=', ')
        return schemas.AndroidMessageResponse(data=[])


@router.post(
    '/message/confirm',
    response_model=schemas.AndroidCodeResponse,
    status_code=status.HTTP_200_OK
)
async def confirm_message(
    *,
    db: AsyncSession = Depends(deps.get_db),
    device: str = Form(...),
    param_json: str = Form(...),
    _ = Depends(deps.get_user_by_api_key),
) -> Any:
    """
    Confirm message receive.
    """
    if False:
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
    status_code=status.HTTP_200_OK
)
async def set_message_status(
    *,
    session: AsyncSession = Depends(deps.get_db),
    device: str = Form(...),
    param_json: str = Form(...),
    user = Depends(deps.get_user_by_api_key)
) -> Any:
    """
    Set message status.
    """
    try:
        items = json.loads(param_json)
        for obj in items:
            # Всегда читаем актуальное состояние перед каждым апдейтом
            campaign_dst = await crud.campaign_dst.get(db=session, id=obj.get('id'))
            if not campaign_dst:
                # можно просто пропустить, либо 404 на весь пакет — на твой выбор
                continue

            # 1) отметка как SENT, если пришла дата отправки и текущий статус WAITING
            if obj.get('date_send') and campaign_dst.status == schemas.CampaignDstStatus.WAITING:
                try:
                    await services.message.set_status_processing(
                        session=session, user=user,
                        id=campaign_dst.id, status='sent'
                    )
                except Exception as e:
                    logging.exception(
                        'Android set status error (sent) '
                        f'(campaign_dst: {campaign_dst.id}) - {type(e).__name__}: {e}'
                    )

            # 2) отметка как DELIVERED
            if obj.get('date_deliv'):
                try:
                    await services.message.set_status_processing(
                        session=session, user=user,
                        id=campaign_dst.id, status='delivered'
                    )
                except Exception as e:
                    logging.exception(
                        'Android set status error (delivered) '
                        f'(campaign_dst: {campaign_dst.id}) - {type(e).__name__}: {e}'
                    )

            # 3) отметка как FAILED (Если текущий статус WAITING или SENT)
            if obj.get('date_error') and campaign_dst.status in (
                schemas.CampaignDstStatus.WAITING, schemas.CampaignDstStatus.SENT
            ):
                try:
                    await services.message.set_status_processing(
                        session=session, user=user,
                        id=campaign_dst.id, status='failed'
                    )
                except Exception as e:
                    logging.exception(
                        'Android set status error (failed) '
                        f'(campaign_dst: {campaign_dst.id}) - {type(e).__name__}: {e}'
                    )

        return schemas.AndroidCodeResponse(code='0')

    except Exception as e:
        error = f'{type(e).__name__}: {e}'
        logging.exception('Android set status error - %s', error)
        return schemas.AndroidCodeResponse(code='100', error=error)


@router.get("/apk")
async def download_apk(
    *,
    db: AsyncSession = Depends(deps.get_db),
    _ = Depends(deps.get_user_by_api_key)
):
    version = await crud.version.get_last(db=db)
    if not version:
        raise HTTPException(status_code=404, detail="Apk Version not found")
    if not version.file_name:
        raise HTTPException(
            status_code=404, detail="Apk filename not specified"
        )

    file_path = UPLOAD_DIR / version.file_name

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Apk File not found")

    return FileResponse(
        path=file_path,
        filename=version.file_name,
        media_type="application/vnd.android.package-archive"
    )