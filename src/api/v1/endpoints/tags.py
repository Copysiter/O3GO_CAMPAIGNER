from typing import Any, List  # noqa

from fastapi import APIRouter, Depends, HTTPException, status  # noqa
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa

import crud, models, schemas  # noqa


router = APIRouter()


@router.get('/', response_model=schemas.TagRows)
async def read_tags(
    db: AsyncSession = Depends(deps.get_db),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve tags.
    """
    if not orders:
        orders = [{'field': 'id', 'dir': 'desc'}]
    tags = await crud.tag.get_rows(
        db, filters=filters, orders=orders, skip=skip, limit=limit
    )
    count = await crud.tag.get_count(db, filters=filters)
    return {'data': tags, 'total': count}


@router.post(
    '/',
    response_model=schemas.Tag,
    status_code=status.HTTP_201_CREATED
)
async def create_tag(
    *,
    db: AsyncSession = Depends(deps.get_db),
    tag_in: schemas.TagCreate,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create new tag.
    """
    tag = await crud.tag.create(
        db=db, obj_in=tag_in
    )
    return tag


@router.put('/{id}', response_model=schemas.Tag)
async def update_tag(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    tag_in: schemas.TagUpdate,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update an tag.
    """
    tag = await crud.tag.get(db=db, id=id)
    if not tag:
        raise HTTPException(status_code=404, detail='Tag not found')
    tag = await crud.tag.update(db=db, db_obj=tag, obj_in=tag_in)
    return tag


@router.get('/{id}', response_model=schemas.Tag)
async def read_tag(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get tag by ID.
    """
    tag = await crud.tag.get(db=db, id=id)
    if not tag:
        raise HTTPException(status_code=404, detail='Tag not found')
    return tag


@router.delete('/{id}', response_model=schemas.Tag)
async def delete_tag(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete an tag.
    """
    tag = await crud.tag.get(db=db, id=id)
    if not tag:
        raise HTTPException(status_code=404, detail='Tag not found')
    tag = await crud.tag.delete(db=db, id=id)
    return tag
