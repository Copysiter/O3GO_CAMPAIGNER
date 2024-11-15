from typing import Any, List  # noqa

from fastapi import APIRouter, Depends, HTTPException, status  # noqa
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa

import crud, models, schemas  # noqa


router = APIRouter()


@router.get('/', response_model=schemas.ApiKeyRows)
async def read_api_keys(
    db: AsyncSession = Depends(deps.get_db),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve api_keys.
    """
    if not orders:
        orders = [{'field': 'id', 'dir': 'desc'}]
    if not current_user.is_superuser:
        filters.append(
            {'field': 'user_id', 'operator': 'eq', 'value': current_user.id}
        )
    api_keys = await crud.api_key.get_rows(
        db, filters=filters, orders=orders, skip=skip, limit=limit
    )
    count = await crud.api_key.get_count(db, filters=filters)
    return {'data': jsonable_encoder(api_keys), 'total': count}


@router.post(
    '/',
    response_model=schemas.ApiKey,
    status_code=status.HTTP_201_CREATED
)
async def create_api_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    api_key_in: schemas.ApiKeyCreate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new api_key.
    """
    if not api_key_in.user_id:
        api_key_in.user_id = current_user.id
    api_key = await crud.api_key.create(
        db=db, obj_in=api_key_in
    )
    return api_key


@router.put('/{id}', response_model=schemas.ApiKey)
async def update_api_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    api_key_in: schemas.ApiKeyUpdate,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update an api_key.
    """
    api_key = await crud.api_key.get(db=db, id=id)
    if not api_key or (not current_user.is_superuser
                       and api_key.user_id != current_user.id):
        raise HTTPException(status_code=404, detail='ApiKey not found')
    if not api_key_in.user_id:
        api_key_in.user_id = current_user.id
    api_key = await crud.api_key.update(db=db, db_obj=api_key, obj_in=api_key_in)
    return api_key


@router.get('/{id}', response_model=schemas.ApiKey)
async def read_api_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get api_key by ID.
    """
    api_key = await crud.api_key.get(db=db, id=id)
    if not api_key or (not current_user.is_superuser
                       and api_key.user_id != current_user.id):
        raise HTTPException(status_code=404, detail='ApiKey not found')
    return api_key


@router.delete('/{id}', response_model=schemas.ApiKey)
async def delete_api_key(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete an api_key.
    """
    api_key = await crud.api_key.get(db=db, id=id)
    if not api_key or (not current_user.is_superuser
                       and api_key.user_id != current_user.id):
        raise HTTPException(status_code=404, detail='ApiKey not found')
    api_key = await crud.api_key.delete(db=db, id=id)
    return api_key
