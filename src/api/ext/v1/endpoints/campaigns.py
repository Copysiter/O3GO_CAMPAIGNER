from collections import defaultdict
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps
import crud
import models
import schemas


router = APIRouter()

FULL_TIME_SCHEDULE = {
    day: list(range(24))
    for day in range(1, 8)
}


async def resolve_relations(
    db: AsyncSession,
    *,
    user: models.User,
    androids: list[str],
    api_keys: list[str],
    tags: list[str],
) -> tuple[list[str], list[str], list[int], list[str]]:
    android_rows = []
    if androids:
        statement = select(models.Android).where(
            models.Android.device.in_(androids)
        )
        if not user.is_superuser:
            statement = statement.where(models.Android.user_id == user.id)
        result = await db.execute(
            statement
        )
        android_rows = result.unique().scalars().all()

    tag_rows = []
    if tags:
        statement = select(models.Tag).where(models.Tag.name.in_(tags))
        if not user.is_superuser:
            statement = statement.where(models.Tag.user_id == user.id)
        result = await db.execute(
            statement
        )
        tag_rows = result.unique().scalars().all()

    tags_by_name = defaultdict(list)
    for tag in tag_rows:
        tags_by_name[tag.name].append(tag)

    tag_api_keys = {
        key.api_key
        for tag in tag_rows
        for key in tag.keys
    }
    requested_api_keys = set(api_keys) | tag_api_keys
    api_key_rows = []
    if requested_api_keys:
        statement = select(models.ApiKey).where(
            models.ApiKey.value.in_(requested_api_keys)
        )
        if not user.is_superuser:
            statement = statement.where(models.ApiKey.user_id == user.id)
        result = await db.execute(
            statement
        )
        api_key_rows = result.unique().scalars().all()

    found_androids = {row.device for row in android_rows}
    found_api_keys = {row.value for row in api_key_rows}
    ambiguous_tags = sorted(
        name for name, rows in tags_by_name.items()
        if len(rows) > 1
    )
    missing = {
        "androids": sorted(set(androids) - found_androids),
        "api_keys": sorted(set(api_keys) - found_api_keys),
        "tags": sorted(set(tags) - set(tags_by_name)),
        "tag_api_keys": sorted(tag_api_keys - found_api_keys),
    }

    if any(missing.values()) or ambiguous_tags:
        detail = {
            "message": "Related records were not found or are ambiguous",
            **missing,
        }
        if ambiguous_tags:
            detail["ambiguous_tags"] = ambiguous_tags
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        )

    tag_ids = [tags_by_name[name][0].id for name in tags]
    return androids, api_keys, tag_ids, tags


async def get_owned_campaign(
    db: AsyncSession,
    *,
    campaign_id: int,
    user_id: int,
) -> models.Campaign:
    result = await db.execute(
        select(models.Campaign)
        .where(
            models.Campaign.id == campaign_id,
            models.Campaign.user_id == user_id,
        )
        .with_for_update(of=models.Campaign)
    )
    campaign = result.unique().scalar_one_or_none()
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )
    return campaign


def serialize_campaign(
    campaign: models.Campaign,
    *,
    tag_names: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "id": campaign.id,
        "name": campaign.name,
        "status": campaign.status,
        "create_ts": campaign.create_ts,
        "start_ts": campaign.start_ts,
        "stop_ts": campaign.stop_ts,
        "androids": list(campaign.androids),
        "api_keys": list(campaign.api_keys),
        "tags": (
            tag_names
            if tag_names is not None
            else [tag.name for tag in campaign.tags]
        ),
    }


@router.post(
    "",
    response_model=schemas.ExternalCampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_campaign(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user: models.User = Depends(deps.get_user_by_api_key),
    campaign_in: schemas.ExternalCampaignCreate,
) -> Any:
    androids, api_keys, tag_ids, tag_names = await resolve_relations(
        db,
        user=user,
        androids=campaign_in.androids,
        api_keys=campaign_in.api_keys,
        tags=campaign_in.tags,
    )
    campaign = await crud.campaign.create(
        db=db,
        obj_in=schemas.CampaignCreate(
            name=campaign_in.name,
            user_id=user.id,
            msg_template=campaign_in.msg_template,
            webhook_url=(
                str(campaign_in.webhook_url)
                if campaign_in.webhook_url
                else None
            ),
            androids=androids,
            api_keys=api_keys,
            tags=tag_ids,
            schedule=FULL_TIME_SCHEDULE,
            msg_attempts=campaign_in.msg_attempts,
            msg_sending_timeout=campaign_in.msg_sending_timeout,
            msg_status_timeout=campaign_in.msg_status_timeout,
            msg_total=0,
            status=schemas.CampaignStatus.CREATED,
            create_ts=datetime.utcnow(),
        ),
    )
    return serialize_campaign(campaign, tag_names=tag_names)


@router.post(
    "/{campaign_id}/start",
    response_model=schemas.ExternalCampaignResponse,
)
async def start_campaign(
    *,
    campaign_id: int,
    db: AsyncSession = Depends(deps.get_db),
    user: models.User = Depends(deps.get_user_by_api_key),
) -> Any:
    campaign = await get_owned_campaign(
        db,
        campaign_id=campaign_id,
        user_id=user.id,
    )
    if campaign.status in (
        schemas.CampaignStatus.STOPPED,
        schemas.CampaignStatus.COMPLETE,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Campaign cannot be started",
        )
    if campaign.status != schemas.CampaignStatus.RUNNING:
        campaign.status = schemas.CampaignStatus.RUNNING
        campaign.start_ts = datetime.utcnow()
        campaign.stop_ts = None
        await db.commit()
        await db.refresh(campaign)
    return serialize_campaign(campaign)


@router.post(
    "/{campaign_id}/stop",
    response_model=schemas.ExternalCampaignResponse,
)
async def stop_campaign(
    *,
    campaign_id: int,
    db: AsyncSession = Depends(deps.get_db),
    user: models.User = Depends(deps.get_user_by_api_key),
) -> Any:
    campaign = await get_owned_campaign(
        db,
        campaign_id=campaign_id,
        user_id=user.id,
    )
    if campaign.status == schemas.CampaignStatus.COMPLETE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Completed campaign cannot be stopped",
        )
    if campaign.status != schemas.CampaignStatus.STOPPED:
        campaign.status = schemas.CampaignStatus.STOPPED
        campaign.stop_ts = datetime.utcnow()
        await db.commit()
        await db.refresh(campaign)
    return serialize_campaign(campaign)
