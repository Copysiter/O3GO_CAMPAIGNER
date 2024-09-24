from typing import List

from fastapi.encoders import jsonable_encoder
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.encoders import jsonable_encoder

from crud.base import CRUDBase
from models.campaign_dst import CampaignDst
from models.campaign import Campaign
from schemas.campaign_dst import CampaignDstCreate, CampaignDstUpdate


class CRUDCampaignDst(CRUDBase[CampaignDst, CampaignDstCreate, CampaignDstUpdate]):
    async def create_rows(
        self, db: AsyncSession, *, obj_in: List[CampaignDstCreate],
    ) -> List[CampaignDst]:
        statement = insert(CampaignDst).values(obj_in)
        await db.execute(statement)
        await db.commit()
        return len(obj_in)
    
    #def get_one(
    #    self, db: Session, *, campaign_id: int
    #) -> CampaignDst:
    #    return db.query(CampaignDst).filter(CampaignDst.campaign_id == campaign_id).first()

    #def get_batch(
    #    self, db: Session
    #) -> List[CampaignDst]:
    #    return db.query(CampaignDst).join(Campaign).group_by(CampaignDst.campaign_id).order_by(Campaign.start_ts).all()

campaign_dst = CRUDCampaignDst(CampaignDst)