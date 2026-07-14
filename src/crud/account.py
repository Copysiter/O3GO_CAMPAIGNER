from typing import List

from sqlalchemy import insert, delete
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.account import Account
from schemas.account import AccountCreate, AccountUpdate

from core.config import settings


class CRUDAccount(CRUDBase[Account, AccountCreate, AccountUpdate]):
    async def create_rows(
        self, db: AsyncSession, *, obj_in: List[AccountCreate],
    ) -> List[Account]:
        statement = insert(Account)
        for i in range(0, len(obj_in), settings.DATABASE_INSERT_BATCH_SIZE):
            batch = obj_in[i:i + settings.DATABASE_INSERT_BATCH_SIZE]
            await db.execute(statement, batch)
        await db.commit()
        return len(obj_in)

    async def delete_rows(
            self, db: AsyncSession, *, campaign_id: int, user_id: int = None
    ) -> None:
        statement = delete(Account).where(
            Account.campaign_id == campaign_id)
        if user_id is not None:
            statement = statement.where(Account.user_id == user_id)
        await db.execute(statement=statement)
        await db.commit()


account = CRUDAccount(Account)
