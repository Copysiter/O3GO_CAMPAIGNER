import uuid, shutil  # noqa

from pathlib import Path
from typing import Any, List  # noqa
from datetime import datetime, timedelta  # noqa

from fastapi import (
    APIRouter, Depends, Request, UploadFile, File, HTTPException, status  # noqa
)
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa

import crud, models, schemas  # noqa


UPLOAD_DIR = Path('upload/wa')
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


router = APIRouter()


@router.get('/', response_model=schemas.AccountRows)
async def read_accounts(
    db: AsyncSession = Depends(deps.get_db),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve accounts.
    """
    if not orders:
        orders = [{'field': 'id', 'dir': 'desc'}]
    accounts = await crud.account.get_rows(
        db, filters=filters, orders=orders, skip=skip, limit=limit
    )
    count = await crud.account.get_count(db, filters=filters)

    now = datetime.utcnow()

    for acc in accounts:
        if (
            acc.status == schemas.AccountStatus.AVAILABLE
            and acc.update_ts and acc.cooldown
            and acc.update_ts + timedelta(minutes=acc.cooldown) > now
        ):
            acc.status = schemas.AccountStatus.PAUSED

    return {'data': accounts, 'total': count}


@router.post(
    '/',
    status_code=status.HTTP_201_CREATED
)
async def create_accounts(
    *,
    db: AsyncSession = Depends(deps.get_db),
    account_in: schemas.AccountMultiCreate,
    user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create new account.
    """
    accounts = []
    for file_name in account_in.files:
        accounts.append(schemas.AccountCreate(
            uuid=str(uuid.uuid4()),
            user_id=user.id,
            file_name=file_name,
            limit=account_in.limit,
            cooldown=account_in.cooldown
        ))
    count = await crud.account.create_rows(db=db, obj_in=accounts)
    return {'count': count}


@router.put('/{id}', response_model=schemas.Account)
async def update_account(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    account_in: schemas.AccountUpdate,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update an account.
    """
    account = await crud.account.get(db=db, id=id)
    if not account:
        raise HTTPException(status_code=404, detail='Account not found')
    account = await crud.account.update(
        db=db, db_obj=account, obj_in=account_in
    )
    return account


@router.get('/{id}', response_model=schemas.Account)
async def read_account(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get account by ID.
    """
    account = await crud.account.get(db=db, id=id)
    if not account:
        raise HTTPException(status_code=404, detail='Account not found')
    return account


@router.delete('/{id}', response_model=schemas.Account)
async def delete_account(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete an account.
    """
    account = await crud.account.get(db=db, id=id)
    if not account:
        raise HTTPException(status_code=404, detail='Account not found')

    account = await crud.account.delete(db=db, id=id)

    if account.file_name:
        file_path = UPLOAD_DIR / account.file_name
        if file_path.exists() and file_path.is_file():
            file_path.unlink()

    return account


@router.post('/upload')
async def upload_apk(file: UploadFile = File(...)):
    if not file.filename.endswith('.tar.gz'):
        raise HTTPException(
            status_code=400, detail='The file must have a .apk extension'
        )
    file_path = UPLOAD_DIR / file.filename

    with file_path.open('wb') as buffer:
        shutil.copyfileobj(file.file, buffer)

    return JSONResponse(content={'file_name': str(file.filename)})


@router.post('/remove')
async def remove_apk(request: Request):
    form = await request.form()
    filename = form.get('file_name')
    if not filename or not filename.endswith(".tar.gz"):
        raise HTTPException(status_code=400, detail="Invalid file name")

    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_path.unlink()

    return JSONResponse(content={"message": "File deleted successfully"})
