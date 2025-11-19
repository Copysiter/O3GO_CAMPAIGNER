from typing import List

from sqlalchemy import insert, delete
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.campaign_dst import CampaignDst
from schemas.campaign_dst import CampaignDstCreate, CampaignDstUpdate

from core.config import settings


class CRUDCampaignDst(CRUDBase[CampaignDst, CampaignDstCreate, CampaignDstUpdate]):
    async def create_rows(
        self, db: AsyncSession, *, obj_in: List[CampaignDstCreate],
    ) -> List[dict]:
        """Create multiple campaign_dst rows and return list of objects with id and dst_addr."""
        created_objects = []
        
        statement = insert(CampaignDst).returning(CampaignDst.id, CampaignDst.dst_addr)
        for i in range(0, len(obj_in), settings.DATABASE_INSERT_BATCH_SIZE):
            batch = obj_in[i:i + settings.DATABASE_INSERT_BATCH_SIZE]
            result = await db.execute(statement, batch)
            batch_objects = [{'id': row[0], 'dst_addr': row[1]} for row in result.fetchall()]
            created_objects.extend(batch_objects)
        
        await db.commit()
        return created_objects

    async def delete_rows(
            self, db: AsyncSession, *, campaign_id: int, user_id: int = None
    ) -> None:
        statement = delete(CampaignDst).where(CampaignDst.campaign_id == campaign_id)
        if user_id is not None:
            statement = statement.where(CampaignDst.user_id == user_id)
        await db.execute(statement=statement)
        await db.commit()
    
    #def get_one(
    #    self, db: Session, *, campaign_id: int
    #) -> CampaignDst:
    #    return db.query(CampaignDst).filter(CampaignDst.campaign_id == campaign_id).first()

    #def get_batch(
    #    self, db: Session
    #) -> List[CampaignDst]:
    #    return db.query(CampaignDst).join(Campaign).group_by(CampaignDst.campaign_id).order_by(Campaign.start_ts).all()


campaign_dst = CRUDCampaignDst(CampaignDst)