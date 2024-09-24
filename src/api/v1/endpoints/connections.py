from typing import Any, List  # noqa

from fastapi import APIRouter, Depends, HTTPException, status  # noqa
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa

import crud, models, schemas  # noqa

router = APIRouter()


@router.get('/', response_model=schemas.ConnectionRows)
async def read_connections(
    db: AsyncSession = Depends(deps.get_db),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve connections.
    """
    if not orders:
        orders = [{'field': 'id', 'dir': 'desc'}]
    connections = await crud.connection.get_rows(
        db, filters=filters, orders=orders, skip=skip, limit=limit
    )
    count = await crud.connection.get_count(db, filters=filters)
    return {'data': connections, 'total': count}


@router.post(
    '/',
    response_model=schemas.Connection,
    status_code=status.HTTP_201_CREATED
)
async def create_connection(
    *,
    db: AsyncSession = Depends(deps.get_db),
    connection_in: schemas.ConnectionCreate,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new connection.
    """
    connection = await crud.connection.get_by_login(db, login=connection_in.login)
    if connection:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='The connection with this login already exists in the system.',
            # noqa
        )
    connection = await crud.connection.create(
        db=db, obj_in=connection_in
    )
    return connection


@router.put('/{id}', response_model=schemas.Connection)
async def update_connection(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    connection_in: schemas.ConnectionUpdate,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update an connection.
    """
    connection = await crud.connection.get(db=db, id=id)
    if not connection:
        raise HTTPException(status_code=404, detail='Connection not found')
    connection = await crud.connection.update(db=db, db_obj=connection, obj_in=connection_in)
    return connection


@router.get('/{id}', response_model=schemas.Connection)
async def read_connection(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get connection by ID.
    """
    connection = await crud.connection.get(db=db, id=id)
    if not connection:
        raise HTTPException(status_code=404, detail='Connection not found')
    return connection


@router.delete('/{id}', response_model=schemas.Connection)
async def delete_connection(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete an connection.
    """
    connection = await crud.connection.get(db=db, id=id)
    if not connection:
        raise HTTPException(status_code=404, detail='Connection not found')
    connection = await crud.connection.delete(db=db, id=id)
    return connection
