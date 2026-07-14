from typing import Any, List, Dict, Optional, Union  # noqa

from fastapi.encoders import jsonable_encoder

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import get_password_hash, verify_password  # noqa
from crud.base import CRUDBase  # noqa
from models.permission import Permission, UserPermission  # noqa
from models.user import User, UserApiKeys  # noqa
from schemas.user import UserCreate, UserUpdate  # noqa


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    def normalize_keys(self, keys: list = None) -> List[str]:
        return [key for key in (keys or []) if key]

    async def prepare_permission_links(
        self, db: AsyncSession, *, permission_keys: list = None
    ) -> List[UserPermission]:
        permission_keys = self.normalize_keys(permission_keys)
        if not permission_keys:
            return []
        statement = select(Permission).where(
            Permission.key.in_(permission_keys),
            Permission.is_active == True,
        )
        results = await db.execute(statement=statement)
        permissions = results.unique().scalars().all()
        return [
            UserPermission(permission_id=permission.id)
            for permission in permissions
        ]

    async def get_by(
        self, db: AsyncSession, **kwargs: Dict[str, Any]
    ) -> Optional[User]:
        statement = select(User)
        for attr, val in kwargs.items():
            statement = statement.where(getattr(User, attr) == val)
        results = await db.execute(statement=statement)
        return results.unique().scalar_one_or_none()

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
            ext_api_key=obj_in.ext_api_key,
            is_active=obj_in.is_active,
            is_superuser=obj_in.is_superuser,
        )
        db_obj.keys = [
            UserApiKeys(api_key=key)
            for key in self.normalize_keys(obj_in.api_keys)
        ]
        db_obj.permission_links = await self.prepare_permission_links(
            db, permission_keys=obj_in.permissions
        )
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
        api_keys = update_data.pop('api_keys', None)
        permissions = update_data.pop('permissions', None)
        if update_data.get('password'):
            hashed_password = get_password_hash(update_data['password'])
            del update_data['password']
            update_data['hashed_password'] = hashed_password
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        if api_keys is not None:
            db_obj.keys = [
                UserApiKeys(api_key=key)
                for key in self.normalize_keys(api_keys)
            ]
        if permissions is not None:
            db_obj.permission_links = await self.prepare_permission_links(
                db, permission_keys=permissions
            )
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
