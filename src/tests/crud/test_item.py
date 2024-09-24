import pytest

from sqlalchemy.ext.asyncio import AsyncSession

from schemas.item import ItemCreate, ItemUpdate  # noqa
from tests.utils.user import create_random_user  # noqa
from tests.utils.utils import random_lower_string  # noqa

import crud  # noqa


@pytest.mark.asyncio
async def test_create_item(db: AsyncSession) -> None:
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    user = await create_random_user(db)
    item = await crud.item.create_with_user(
        db=db, obj_in=item_in, user_id=user.id
    )
    assert item.title == title
    assert item.description == description
    assert item.user_id == user.id


@pytest.mark.asyncio
async def test_get_item(db: AsyncSession) -> None:
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    user = await create_random_user(db)
    item = await crud.item.create_with_user(
        db=db, obj_in=item_in, user_id=user.id
    )
    stored_item = await crud.item.get(db=db, id=item.id)
    assert stored_item
    assert item.id == stored_item.id
    assert item.title == stored_item.title
    assert item.description == stored_item.description
    assert item.user_id == stored_item.user_id


@pytest.mark.asyncio
async def test_update_item(db: AsyncSession) -> None:
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    user = await create_random_user(db)
    item = await crud.item.create_with_user(
        db=db, obj_in=item_in, user_id=user.id
    )
    description2 = random_lower_string()
    item_update = ItemUpdate(description=description2)
    item2 = await crud.item.update(db=db, db_obj=item, obj_in=item_update)
    assert item.id == item2.id
    assert item.title == item2.title
    assert item2.description == description2
    assert item.user_id == item2.user_id


@pytest.mark.asyncio
async def test_delete_item(db: AsyncSession) -> None:
    title = random_lower_string()
    description = random_lower_string()
    item_in = ItemCreate(title=title, description=description)
    user = await create_random_user(db)
    item = await crud.item.create_with_user(
        db=db, obj_in=item_in, user_id=user.id
    )
    item2 = await crud.item.delete(db=db, id=item.id)
    item3 = await crud.item.get(db=db, id=item.id)
    assert item3 is None
    assert item2.id == item.id
    assert item2.title == title
    assert item2.description == description
    assert item2.user_id == user.id
