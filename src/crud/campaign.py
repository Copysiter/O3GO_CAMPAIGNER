from datetime import datetime, timedelta
from typing import Union, Any, Dict, List

from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.campaign import Campaign, CampaignApiKeys, CampaignTags
from models.campaign_dst import CampaignDst
from models.tag import Tag
from models.api_key import ApiKey
from schemas.campaign import CampaignCreate, CampaignUpdate
from schemas.status import CampaignDstStatus


class CRUDCampaign(CRUDBase[Campaign, CampaignCreate, CampaignUpdate]):
    async def get_rows_by_user(
        self, db: AsyncSession, *, user_id: int,
        filters: list = None, orders: list = None,
        skip: int = 0, limit: int = 100,
    ) -> List[Campaign]:
        filter_list = self.get_filters(filters) if filters else []
        order_list = self.get_orders(orders) if orders else []
        statement = (select(Campaign).
                     where(Campaign.user_id == user_id).
                     where(*filter_list).order_by(*order_list).
                     offset(skip).limit(limit))
        results = await db.execute(statement=statement)
        campaigns = results.unique().scalars().all()
        for campaign in campaigns:
            campaign.campaign_tags = [
                campaign_tag for campaign_tag in campaign.campaign_tags if
                campaign_tag.tag.user_id == user_id
            ]
            campaign.keys = [
                api_key for api_key in campaign.keys if
                api_key.key.user_id == user_id
            ]
            campaign.api_keys = [key.api_key for key in campaign.keys]
        return campaigns

    async def get_count_by_user(
        self, db: AsyncSession, *, user_id: int, filters: dict = None
    ) -> int:
        filter_list = self.get_filters(filters) if filters else []
        statement = (select(func.count(self.model.id)).
                     where(self.model.user_id == user_id).
                     where(*filter_list))
        results = await db.execute(statement=statement)
        return results.scalar_one()

    async def update_keys(
        self, db: AsyncSession, *, db_obj: Campaign, removed_keys: list = None
    ) -> Campaign:
        if db_obj.tags:
            api_keys = [key for key in db_obj.api_keys
                        if key not in (removed_keys or [])]
            for tag in db_obj.tags:
                for key in tag.keys:
                    if key not in api_keys:
                        api_keys.append(key.api_key)
            db_obj.keys = [CampaignApiKeys(api_key=key) for key in api_keys]
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
        return db_obj

    async def create(
        self, db: AsyncSession, *, obj_in: CampaignCreate
    ) -> Campaign:
        if isinstance(obj_in, dict):
            obj_in_data = obj_in
        else:
            obj_in_data = obj_in.model_dump(exclude_unset=True)
        obj_in_data['campaign_tags'] = [
            CampaignTags(tag_id=id)
            for id in (obj_in_data.pop('tags', []) or [])
        ]
        obj_in_data['keys'] = [
            CampaignApiKeys(api_key=key)
            for key in (obj_in_data.pop('api_keys', []) or [])
        ]
        campaign = await super().create(db, obj_in=obj_in_data)
        campaign = await self.update_keys(db, db_obj=campaign)
        return campaign

    async def update(
        self, db: AsyncSession, *, db_obj: Campaign,
        obj_in: Union[CampaignUpdate, Dict[str, Any]]
    ) -> Campaign:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=False)
        if 'tags' in update_data:
            update_data['campaign_tags'] = [
                CampaignTags(tag_id=id)
                for id in (update_data.pop('tags', []) or [])
            ]
        if 'keys' in update_data:
            update_data['keys'] = [
                CampaignApiKeys(api_key=key)
                for key in (update_data.pop('api_keys', []) or [])
            ]
        if 'msg_attempts' in update_data and \
                db_obj.msg_attempts != update_data['msg_attempts']:
            statement = update(CampaignDst).where(
                CampaignDst.campaign_id == db_obj.id,
                CampaignDst.status.not_in([
                    CampaignDstStatus.DELIVERED,
                    CampaignDstStatus.UNDELIVERED
                ])
            ).values(attempts=update_data['msg_attempts'])
            await db.execute(statement)
            await db.execute(statement)
        if 'msg_sending_timeout' in update_data and \
            db_obj.msg_sending_timeout != \
                update_data['msg_sending_timeout']:
            statement = update(CampaignDst).where(
                CampaignDst.campaign_id == db_obj.id,
                CampaignDst.status == CampaignDstStatus.CREATED
            ).values(
                expire_ts=(datetime.utcnow() + timedelta(
                    seconds=update_data['msg_sending_timeout']
                )) if update_data['msg_sending_timeout'] else None
            )
            await db.execute(statement)
            await db.execute(statement)
        campaign = await super().update(
            db, db_obj=db_obj, obj_in=update_data)
        campaign = await self.update_keys(db, db_obj=campaign)
        return campaign

    async def update_rows(
        self, db: AsyncSession, *, ids: List[int],
        obj_in: Dict[str, Any], user_id: int = None
    ) -> Campaign:
        statement = update(self.model).where(self.model.id.in_(ids))
        if user_id is not None:
            statement = statement.where(Campaign.user_id == user_id)
        statement = statement.values(**obj_in)
        await db.execute(statement)
        statement = select(self.model).where(self.model.id.in_(ids))
        if user_id is not None:
            statement = statement.where(Campaign.user_id == user_id)
        results = await db.execute(statement=statement)
        await db.commit()
        return results.unique().scalars().all()

    async def delete_rows(
        self, db: AsyncSession, *, ids: List[int], user_id: int = None
    ) -> List[int]:
        statement = delete(Campaign).where(Campaign.id.in_(ids))
        if user_id is not None:
            statement = statement.where(Campaign.user_id == user_id)
        statement = statement.returning(Campaign.id)
        result = await db.execute(statement=statement)
        await db.commit()
        r = result.scalars().all()
        return r


campaign = CRUDCampaign(Campaign)