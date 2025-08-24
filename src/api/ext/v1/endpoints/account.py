import random
import string
import logging

from typing import Any, Union
from pathlib import Path
from datetime import datetime

from fastapi import (
    Request, APIRouter, Depends, status
)
from fastapi.responses import FileResponse
from sqlalchemy import select, update, func, or_
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

import models, schemas, crud

from api import deps


def generate_auth_code(length=6):
    characters = string.ascii_uppercase + string.digits
    return ''.join(random.choices(characters, k=length))


UPLOAD_DIR = Path('upload/wa')
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter()


async def _unlink_with_status(
    session: AsyncSession,
    obj_in: schemas.AccountUnlinkRequest,
    user: schemas.User,
    status: int
) -> schemas.AndroidCodeResponse:
    try:
        async with session.begin():
            statement = (
                update(models.Android)
                .where (
                    models.Android.device == obj_in.device,
                    models.Android.user_id == user.id
                )
                .values(account_id=None)
                .returning(models.Android)
            )

            row = (await session.execute(statement)).first()
            if row is None:
                return {'code': '100', 'error': 'Device not found'}

            statement = (
                update(models.Account)
                .where(models.Account.id == obj_in.id_task)
                .values(
                    status=status,
                    sent=func.coalesce(models.Account.sent, 0) + (obj_in.sent or 0)
                )
                .returning(models.Account)
            )

            row = (await session.execute(statement)).first()
            if row is None:
                return {'code': '100', 'error': 'Task not found'}
            return {'code': '0'}
    except Exception as e:
        logging.exception(
            'Unlink account error'
            f'{type(e).__name__}: {str(e)}'
        )
        return {'code': '100', 'error': f'{type(e).__name__}: {e}'}


@router.post(
    '/',
    response_model = Union[
        schemas.AccountLinkResponse, schemas.AndroidCodeResponse
    ],
    status_code = status.HTTP_200_OK
)
async def link_account(
    *,
    session: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AccountLinkRequest = \
            Depends(deps.as_form(schemas.AccountLinkRequest)),
    user = Depends(deps.get_user_by_api_key),
    request: Request
) -> Any:
    try:
        async with session.begin():
            row = await session.execute(
                select(models.Android)
                .where(
                    models.Android.device == obj_in.device,
                    models.Android.user_id == user.id
                )
                .with_for_update(of=models.Android)
            )
            android = row.scalars().first()
            if android is None:
                return {'code': '100', 'error': 'Device not found'}
            account = android.account
            if not account or account.status != schemas.AccountStatus.ACTIVE:
                A = aliased(models.Account)

                locked = (
                    select(A.id)
                    .where(
                        A.status == schemas.AccountStatus.AVAILABLE,
                        A.user_id == user.id,
                        or_(
                            A.update_ts.is_(None), datetime.utcnow() > (
                                A.update_ts + func.make_interval(
                                    0, 0, 0, 0, 0, A.cooldown, 0
                                )
                            )
                        ),
                    )
                    .order_by(A.update_ts.asc().nullsfirst(), A.id.asc())
                    .limit(1)
                    .with_for_update(skip_locked=True)
                    .cte('locked')
                )

                statement = (
                    update(models.Account)
                    .where(
                        models.Account.id == select(locked.c.id).scalar_subquery()
                    )
                    .values(
                        status=schemas.AccountStatus.ACTIVE,
                        update_ts=datetime.utcnow()
                    )
                    .returning(models.Account)
                )

                row = (await session.execute(statement)).first()
                if row is None:
                    return {'code': '100', 'error': 'Account not found'}
                account = row[0]

            android.account_id = account.id
            await session.flush()

            scheme, host, port = \
                request.url.scheme, request.url.hostname, request.url.port
            if (scheme == 'http' and port != 80) \
                    or (scheme == 'https' and port != 443):
                base_url = f'{scheme}://{host}:{port}'
            else:
                base_url = f'{scheme}://{host}'
            url = f'{base_url}/ext/api/v1/android/accounts/{account.uuid}'

            return {
                'id_task': account.id,
                'cnt_msg_iteration': account.limit,
                'status': account.status,
                'url': url,
                'code': '0'
            }
    except Exception as e:
        logging.exception(
            'Link account error'
            f'{type(e).__name__}: {str(e)}'
        )
        return {'code': '100', 'error': f'{type(e).__name__}: {e}'}


@router.post(
    '/finish',
    response_model=schemas.AndroidCodeResponse,
    status_code=status.HTTP_200_OK
)
async def unlink_account(
    *,
    session: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AccountUnlinkRequest = \
            Depends(deps.as_form(schemas.AccountUnlinkRequest)),
    user = Depends(deps.get_user_by_api_key),
) -> Any:
    return await _unlink_with_status(
        session, obj_in, user, schemas.AccountStatus.AVAILABLE
    )


@router.post(
    '/ban',
    response_model=schemas.AndroidCodeResponse,
    status_code=status.HTTP_200_OK
)
async def ban_account(
    *,
    session: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AccountUnlinkRequest = \
            Depends(deps.as_form(schemas.AccountUnlinkRequest)),
    user = Depends(deps.get_user_by_api_key),
) -> Any:
    return await _unlink_with_status(
        session, obj_in, user, schemas.AccountStatus.BANNED
    )


@router.get("/{uuid}")
async def download_archive(
    *,
    db: AsyncSession = Depends(deps.get_db),
    uuid: str, _ = Depends(deps.get_user_by_api_key)
):
    account = await crud.account.get_by(db=db, uuid=uuid)
    if not account:
        return {'code': '100','error': f'Archive with UUID={uuid} not found'}
    if not account.file_name:
        return {'code': '100', 'error': 'Archive filename not specified'}

    file_path = UPLOAD_DIR / account.file_name

    if not file_path.exists():
        return {'code': '100', 'error': f'Filen {file_path} not found'}

    return FileResponse(
        path=file_path, filename=account.file_name,
        media_type='application/gzip'
    )