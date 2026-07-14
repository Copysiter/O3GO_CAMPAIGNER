from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.permissions import DEFAULT_PERMISSIONS
from crud.base import CRUDBase
from models.permission import Permission
from schemas.permission import PermissionCreate, PermissionUpdate


class CRUDPermission(CRUDBase[Permission, PermissionCreate, PermissionUpdate]):
    async def get_by_key(
        self, db: AsyncSession, *, key: str
    ) -> Optional[Permission]:
        statement = select(Permission).where(Permission.key == key)
        results = await db.execute(statement=statement)
        return results.unique().scalar_one_or_none()

    async def ensure_defaults(self, db: AsyncSession) -> None:
        for item in DEFAULT_PERMISSIONS:
            db_obj = await self.get_by_key(db, key=item['key'])
            if db_obj:
                for field in ('name', 'description'):
                    setattr(db_obj, field, item[field])
                if db_obj.is_active is None:
                    db_obj.is_active = True
            else:
                db.add(Permission(**item, is_active=True))
        await db.commit()

    async def get_active_by_keys(
        self, db: AsyncSession, *, keys: List[str]
    ) -> List[Permission]:
        if not keys:
            return []
        statement = select(Permission).where(
            Permission.key.in_(keys),
            Permission.is_active == True,
        )
        results = await db.execute(statement=statement)
        return results.unique().scalars().all()


permission = CRUDPermission(Permission)
