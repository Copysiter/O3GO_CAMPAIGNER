from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase  # noqa
from models.api_key import ApiKey  # noqa
from schemas.api_key import ApiKeyCreate, ApiKeyUpdate  # noqa


class CRUDApiKey(CRUDBase[ApiKey, ApiKeyCreate, ApiKeyUpdate]):
    async def get_by_alias(
        self, db: AsyncSession, *, alias: str
    ) -> ApiKey:
        statement = (select(self.model).
                     where(self.model.alias == alias))
        results = await db.execute(statement=statement)
        return results.unique().scalar_one_or_none()


api_key = CRUDApiKey(ApiKey)
