from typing import List, Any, Annotated

from fastapi import APIRouter, Body, Depends, Query, HTTPException, status  # noqa
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa
from core.config import settings  # noqa

import crud, models, schemas  # noqa


router = APIRouter()


@router.get('/', response_model=schemas.UserRows)
async def read_users(
    db: AsyncSession = Depends(deps.get_db),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: Annotated[
        int, Query(description='Pagination page offset', ge=0)] = 0,
    limit: Annotated[
        int, Query(description='Pagination page size', ge=1)] = 100,
    current_user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Retrieve users.
    """
    if not orders:
        orders = [{'field': 'id', 'dir': 'desc'}]
    users = await crud.user.get_rows(
        db, filters=filters, orders=orders,
        skip=skip, limit=limit
    )
    count = await crud.user.get_count(db, filters=filters)
    return {'data': users, 'total': count}


@router.post(
    '/',
    response_model=schemas.User,
    status_code=status.HTTP_201_CREATED
)
async def create_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: schemas.UserCreate,
    current_user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Create new user.
    """
    user = await crud.user.get_by_login(db, login=user_in.login)
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='The user with this username already exists in the system.', # noqa
        )
    user = await crud.user.create(db, obj_in=user_in)
    return user


@router.put('/me', response_model=schemas.User)
async def update_user_me(
    *,
    db: AsyncSession = Depends(deps.get_db),
    password: str = Body(None),
    name: str = Body(None),
    login: str = Body(None),
    current_user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Update own user.
    """
    current_user_data = jsonable_encoder(current_user)
    user_in = schemas.UserUpdate(**current_user_data)
    if password is not None:
        user_in.password = password
    if name is not None:
        user_in.name = name
    if login is not None:
        user_in.login = login
    user = await crud.user.update(db, db_obj=current_user, obj_in=user_in)
    return user


@router.get('/me', response_model=schemas.User)
async def read_user_me(
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.get('/{user_id}', response_model=schemas.User)
async def read_user_by_id(
    user_id: int,
    current_user: models.User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Get a specific user by id.
    """
    user = await crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail='User not found'
        )
    if user == current_user:
        return user
    if not crud.user.is_superuser(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='The user doesn\'t have enough privileges'
        )
    return user


@router.put('/{user_id}', response_model=schemas.User)
async def update_user(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_id: int,
    user_in: schemas.UserUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Update a user.
    """
    user = await crud.user.get(db, id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='The user with this username does not exist in the system',
        )
    user = await crud.user.update(db, db_obj=user, obj_in=user_in)
    return user


@router.delete('/{id}', response_model=schemas.User)
async def delete_device(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Delete an user.
    """
    user = await crud.user.get(db=db, id=id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    user = await crud.user.delete(db=db, id=id)
    return user
