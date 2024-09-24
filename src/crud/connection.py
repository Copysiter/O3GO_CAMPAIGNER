from typing import Any, List, Dict, Optional, Union  # noqa

from fastapi.encoders import jsonable_encoder

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import get_password_hash, verify_password  # noqa
from crud.base import CRUDBase  # noqa
from models.connection import Connection, ConnectionApiKeys  # noqa
from schemas.connection import ConnectionCreate, ConnectionUpdate  # noqa


class CRUDConnection(CRUDBase[Connection, ConnectionCreate, ConnectionUpdate]):
    async def get_by_login(
        self, db: AsyncSession, *, login: str
    ) -> Optional[Connection]:
        statement = select(Connection).where(Connection.login == login)
        results = await db.execute(statement=statement)
        return results.unique().scalar_one_or_none()

    async def create(self, db: AsyncSession, *, obj_in: ConnectionCreate) -> Connection:
        db_obj = Connection(
            user_id=obj_in.user_id,
            login=obj_in.login,
            password=obj_in.password,
            name=obj_in.name,
            is_active=obj_in.is_active,
        )
        db_obj.keys = [ConnectionApiKeys(api_key=key) for key in obj_in.api_keys]
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: Connection,
        obj_in: Union[ConnectionUpdate, Dict[str, Any]]
    ) -> Connection:
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db_obj.keys = [ConnectionApiKeys(api_key=key) for key in update_data['api_keys']]
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def authenticate(
        self, db: AsyncSession, *, login: str, password: str
    ) -> Optional[Connection]:
        connection = await self.get_by_login(db, login=login)
        if not connection:
            return None
        if password != connection.hashed_password:
            return None
        return connection

    async def get_api_keys(
        self, db: AsyncSession, *, connection_id: int = None
    ) -> List[Any]:
        statement = select(ConnectionApiKeys.api_key)
        if connection_id:
            statement = statement.where(ConnectionApiKeys.connection_id == connection_id)
        statement = statement.distinct().order_by(ConnectionApiKeys.api_key.asc())
        result = await db.execute(statement=statement)

        return result.mappings().all()

    def is_active(self, connection: Connection) -> bool:
        return connection.is_active


connection = CRUDConnection(Connection)
