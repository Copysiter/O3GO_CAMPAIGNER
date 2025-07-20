from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.version import Version
from schemas.version import VersionCreate, VersionUpdate


class CRUDVersion(CRUDBase[Version, VersionCreate, VersionUpdate]):
    async def get_last(self, db: AsyncSession) -> Optional[Version]:
        statement = select(self.model).order_by(self.model.id.desc()).limit(1)
        result = await db.execute(statement=statement)
        return result.unique().scalar_one_or_none()


version = CRUDVersion(Version)
