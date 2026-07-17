from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps
import crud
import models
import schemas

router = APIRouter()


@router.get('/', response_model=schemas.CampaignDstRows)
async def read_campaign_dsts(
    db: AsyncSession = Depends(deps.get_db),
    filters: List = Depends(deps.request_filters),
    orders: List = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve Campaign DST list with pagination, filtering and sorting.
    """
    data = await crud.campaign_dst.get_rows(
        db, filters=filters, orders=orders, skip=skip, limit=limit
    )
    count = await crud.campaign_dst.get_count(db, filters=filters)
    clicked_pairs = await crud.link.get_clicked_pairs(
        db,
        campaign_dsts=data,
    )
    encoded_data = jsonable_encoder(data)
    for db_obj, item in zip(data, encoded_data):
        item["clicked_link"] = (
            db_obj.campaign_id,
            db_obj.dst_addr,
        ) in clicked_pairs

    return {'data': encoded_data, 'total': count}


@router.post(
    '/',
    response_model=schemas.CampaignDst,
    status_code=status.HTTP_201_CREATED,
)
async def create_campaign_dst(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: schemas.CampaignDstCreate,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create a single Campaign DST.
    """
    return await crud.campaign_dst.create(db=db, obj_in=obj_in)


@router.post(
    '/batch',
    status_code=status.HTTP_201_CREATED,
)
async def create_campaign_dsts_batch(
    *,
    db: AsyncSession = Depends(deps.get_db),
    obj_in: List[schemas.CampaignDstCreate],
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Batch create Campaign DST records.
    Returns list of created objects with id and dst_addr.
    """
    return await crud.campaign_dst.create_rows(db=db, obj_in=obj_in)


@router.put('/{id}', response_model=schemas.CampaignDst)
async def update_campaign_dst(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    obj_in: schemas.CampaignDstUpdate,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update a Campaign DST.
    """
    db_obj = await crud.campaign_dst.get(db=db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail='CampaignDst not found')
    return await crud.campaign_dst.update(
        db=db, db_obj=db_obj, obj_in=obj_in
    )


@router.get('/{id}', response_model=schemas.CampaignDst)
async def read_campaign_dst(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get Campaign DST by ID.
    """
    db_obj = await crud.campaign_dst.get(db=db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail='CampaignDst not found')
    return db_obj


@router.delete('/{id}', response_model=schemas.CampaignDst)
async def delete_campaign_dst(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete a Campaign DST.
    """
    db_obj = await crud.campaign_dst.get(db=db, id=id)
    if not db_obj:
        raise HTTPException(status_code=404, detail='CampaignDst not found')
    return await crud.campaign_dst.delete(db=db, id=id)


@router.delete('/bulk')
async def delete_campaign_dsts_bulk(
    *,
    db: AsyncSession = Depends(deps.get_db),
    campaign_id: int,
    user_id: int | None = None,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Bulk delete Campaign DST records by campaign_id
    (optionally filtered by user_id).
    """
    await crud.campaign_dst.delete_rows(
        db=db, campaign_id=campaign_id, user_id=user_id
    )
    return {'message': 'Deleted successfully'}
