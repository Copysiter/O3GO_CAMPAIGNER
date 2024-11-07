from typing import Union, Any, Dict

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.campaign import Campaign, CampaignApiKeys, CampaignTags
from schemas.campaign import CampaignCreate, CampaignUpdate


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
        update_data['campaign_tags'] = [
            CampaignTags(tag_id=id)
            for id in update_data.pop('tags', [])
        ]
        update_data['keys'] = [
            CampaignApiKeys(api_key=key)
            for key in update_data.pop('api_keys', [])
        ]
        campaign = await super().update(db, db_obj=db_obj, obj_in=update_data)
        return campaign


campaign = CRUDCampaign(Campaign)