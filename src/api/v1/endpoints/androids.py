from typing import Any, List  # noqa

from fastapi import APIRouter, Depends, HTTPException, status  # noqa
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa

import crud, models, schemas  # noqa


router = APIRouter()


@router.get('/', response_model=schemas.AndroidRows)
async def read_androids(
    db: AsyncSession = Depends(deps.get_db),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve android devices.
    """
    if not orders:
        orders = [{'field': 'id', 'dir': 'desc'}]
    rows = await crud.android.get_rows(
        db, filters=filters, orders=orders, skip=skip, limit=limit
    )
    count = await crud.android.get_count(db, filters=filters)
    return {'data': rows, 'total': count}


@router.post(
    '/',
    response_model=schemas.Android,
    status_code=status.HTTP_201_CREATED
)
async def add_android_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.AndroidCreate,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Add new android device.
    """
    db_obj = await crud.android.get_by(db, device=obj_in.device)
    if db_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='This device already exists in the system.',
            # noqa
        )
    db_obj = await crud.android.create(
        db=db, obj_in=obj_in
    )
    return db_obj


@router.put('/{id}', response_model=schemas.Android)
async def update_android_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    obj_in: schemas.AndroidUpdate,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update an android device.
    """
    db_obj = await crud.android.get(db=db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail='Android Device not found')
    db_obj = await crud.android.update(db=db, db_obj=obj_in, obj_in=obj_in)
    return db_obj


@router.get('/{id}', response_model=schemas.Android)
async def read_android_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get android device by ID.
    """
    db_obj = await crud.android.get(db=db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail='Android device not found')
    return db_obj


@router.delete('/{id}', response_model=schemas.Android)
async def delete_android_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete an android.
    """
    db_obj = await crud.android.get(db=db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail='Android device not found')
    db_obj = await crud.android.delete(db=db, id=id)
    return db_obj
