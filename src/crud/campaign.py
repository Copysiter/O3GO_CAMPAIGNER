from typing import Union, Any, Dict

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.campaign import Campaign, CampaignApiKeys
from schemas.campaign import CampaignCreate, CampaignUpdate


class CRUDCampaign(CRUDBase[Campaign, CampaignCreate, CampaignUpdate]):
    #async def create(
    #    self, db: AsyncSession, *, obj_in: CampaignCreate
    #) -> Campaign:
    #    obj_in.keys = [CampaignApiKeys(api_key=key) for key in obj_in.api_keys]
    #    return await super().create(db, obj_in=obj_in)

    #async def update(self, db: AsyncSession, *, db_obj: Campaign,
    #    obj_in: Union[CampaignUpdate, Dict[str, Any]]
    #) -> Campaign:
    #    obj_in.keys = [CampaignApiKeys(api_key=key) for key in obj_in.api_keys]
    #    return await super().update(db=db, db_obj=db_obj, obj_in=obj_in)

    async def create(self, db: AsyncSession, *, obj_in: CampaignCreate) -> Campaign:
        if isinstance(obj_in, dict):
            obj_in_data = obj_in
        else:
            obj_in_data = obj_in.model_dump(exclude_unset=True)
        api_keys = obj_in_data.pop('api_keys')
        campaign = await super().create(db, obj_in=obj_in_data)
        campaign.keys = [CampaignApiKeys(api_key=key) for key in api_keys]
        db.add(campaign)
        await db.commit()
        return campaign

    async def update(
        self, db: AsyncSession, *, db_obj: Campaign,
        obj_in: Union[CampaignUpdate, Dict[str, Any]]
    ) -> Campaign:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        if 'api_keys' in update_data:
            api_keys = update_data.pop('api_keys')
            campaign = await super().update(db, db_obj=db_obj, obj_in=update_data)
            campaign.keys = [CampaignApiKeys(api_key=key) for key in api_keys]
            db.add(campaign)
            await db.commit()
        return campaign


    # def get_msg_rows(
    #     self, db: Session, *, skip: int = 0, limit: int = 100
    # ) -> int:
    #     db.query(Campaign).join(CampaignDst, Campaign.id == CampaignDst.campaign_id).offset(skip).limit(limit).all()
    #     return {}

campaign = CRUDCampaign(Campaign)