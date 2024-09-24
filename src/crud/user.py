from typing import Any, List, Dict, Optional, Union  # noqa

from fastapi.encoders import jsonable_encoder

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import get_password_hash, verify_password  # noqa
from crud.base import CRUDBase  # noqa
from models.user import User, UserApiKeys  # noqa
from schemas.user import UserCreate, UserUpdate  # noqa


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def get_by_login(
        self, db: AsyncSession, *, login: str
    ) -> Optional[User]:
        statement = select(User).where(User.login == login)
        results = await db.execute(statement=statement)
        return results.unique().scalar_one_or_none()

    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        db_obj = User(
            login=obj_in.login,
            hashed_password=get_password_hash(obj_in.password),
            name=obj_in.name,
            is_active=obj_in.is_active,
            is_superuser=obj_in.is_superuser,
        )
        db_obj.keys = [UserApiKeys(api_key=key) for key in obj_in.api_keys]
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: User,
        obj_in: Union[UserUpdate, Dict[str, Any]]
    ) -> User:
        obj_data = jsonable_encoder(db_obj)
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        if update_data.get('password'):
            hashed_password = get_password_hash(update_data['password'])
            del update_data['password']
            update_data['hashed_password'] = hashed_password
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db_obj.keys = [UserApiKeys(api_key=key) for key in update_data['api_keys']]
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def authenticate(
        self, db: AsyncSession, *, login: str, password: str
    ) -> Optional[User]:
        user = await self.get_by_login(db, login=login)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    async def get_api_keys(
        self, db: AsyncSession, *, user_id: int = None
    ) -> List[Any]:
        statement = select(UserApiKeys.api_key)
        if user_id:
            statement = statement.where(UserApiKeys.user_id == user_id)
        statement = statement.distinct().order_by(UserApiKeys.api_key.asc())
        result = await db.execute(statement=statement)

        return result.mappings().all()

    def is_active(self, user: User) -> bool:
        return user.is_active

    def is_superuser(self, user: User) -> bool:
        return user.is_superuser


user = CRUDUser(User)
