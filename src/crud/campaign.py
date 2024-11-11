from datetime import datetime, timedelta
from typing import Union, Any, Dict, List

from fastapi import HTTPException

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.campaign import Campaign, CampaignApiKeys, CampaignTags
from models.campaign_dst import CampaignDst
from schemas.campaign import CampaignCreate, CampaignUpdate
from schemas.status import CampaignDstStatus


class CRUDCampaign(CRUDBase[Campaign, CampaignCreate, CampaignUpdate]):
    async def create(self, db: AsyncSession, *, obj_in: CampaignCreate) -> Campaign:
        if isinstance(obj_in, dict):
            obj_in_data = obj_in
        else:
            obj_in_data = obj_in.model_dump(exclude_unset=True)
        obj_in_data['campaign_tags'] = [
            CampaignTags(tag_id=id)
            for id in obj_in_data.pop('tags', [])
        ]
        obj_in_data['keys'] = [
            CampaignApiKeys(api_key=key)
            for key in obj_in_data.pop('api_keys', [])
        ]
        campaign = await super().create(db, obj_in=obj_in_data)
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
                for id in update_data.pop('tags', [])
            ]
        if 'keys' in update_data:
            update_data['keys'] = [
                CampaignApiKeys(api_key=key)
                for key in update_data.pop('api_keys', [])
            ]
        if 'msg_attempts' in update_data and \
                db_obj.msg_attempts != update_data['msg_attempts']:
            statement = update(CampaignDst).where(
                CampaignDst.campaign_id == db_obj.id
            ).values(attempts=update_data['msg_attempts'])
            await db.execute(statement)
            await db.execute(statement)
        if 'msg_sending_timeout' in update_data and \
            db_obj.msg_sending_timeout != \
                update_data['msg_sending_timeout']:
            statement = update(CampaignDst).where(
                CampaignDst.campaign_id == db_obj.id,
                CampaignDst.status.not_in(
                    CampaignDstStatus.DELIVERED,
                    CampaignDstStatus.UNDELIVERED
                ),
            ).values(
                expire_ts=(datetime.utcnow() + timedelta(
                    seconds=update_data['msg_sending_timeout']
                )) if update_data['msg_sending_timeout'] else None
            )
            await db.execute(statement)
            await db.execute(statement)
        campaign = await super().update(
            db, db_obj=db_obj, obj_in=update_data)
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
    ) -> Campaign:
        statement = delete(self.model).where(self.model.id.in_(ids))
        if user_id is not None:
            statement = statement.where(Campaign.user_id == user_id)
        statement = statement.returning(self.model.id)
        result = await db.execute(statement=statement)
        await db.commit()
        return result.scalars().all()


campaign = CRUDCampaign(Campaign)