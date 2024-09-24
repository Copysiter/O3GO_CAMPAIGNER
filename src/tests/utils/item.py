from typing import Dict, Optional  # noqa

from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings  # noqa
from models import User, Item  # noqa
from schemas import ItemCreate  # noqa

import crud  # noqa

from .utils import random_lower_string
from .user import create_test_user


async def create_test_item(
    db: AsyncSession, *, user_id: Optional[int] = None
) -> Item:
    if user_id is None:
        email = settings.TEST_USER_EMAIL
        password = random_lower_string()
        user = await create_test_user(db, email=email, password=password)
        user_id = user.id
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(
        title=title, description=description
    )
    return await crud.item.create_with_user(
        db=db, obj_in=item_in, user_id=user_id
    )
