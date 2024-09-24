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
        db_obj = Campaign(
            user_id=obj_in.user_id,
            login=obj_in.login,
            password=obj_in.password,
            name=obj_in.name,
            is_active=obj_in.is_active,
        )
        db_obj.keys = [CampaignApiKeys(api_key=key) for key in obj_in.api_keys]
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: Campaign,
        obj_in: Union[CampaignUpdate, Dict[str, Any]]
    ) -> Campaign:
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        if 'api_keys' in update_data:
            db_obj.keys = [CampaignApiKeys(api_key=key) for key in update_data['api_keys']]
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj


    # def get_msg_rows(
    #     self, db: Session, *, skip: int = 0, limit: int = 100
    # ) -> int:
    #     db.query(Campaign).join(CampaignDst, Campaign.id == CampaignDst.campaign_id).offset(skip).limit(limit).all()
    #     return {}

campaign = CRUDCampaign(Campaign)