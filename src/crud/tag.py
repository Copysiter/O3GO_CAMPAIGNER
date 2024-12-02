from typing import Union, Any, Dict

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase  # noqa
from models.tag import Tag, TagApiKeys  # noqa
from schemas.tag import TagCreate, TagUpdate  # noqa


class CRUDTag(CRUDBase[Tag, TagCreate, TagUpdate]):
   async def create(
      self, db: AsyncSession, *, obj_in: TagCreate
   ) -> Tag:
      if isinstance(obj_in, dict):
         obj_in_data = obj_in
      else:
         obj_in_data = obj_in.model_dump(exclude_unset=True)
      obj_in_data['keys'] = [
         TagApiKeys(api_key=key)
         for key in (obj_in_data.pop('api_keys', []) or [])
      ]
      tag = await super().create(db, obj_in=obj_in_data)
      return tag

   async def update(
     self, db: AsyncSession, *, db_obj: Tag,
     obj_in: Union[TagUpdate, Dict[str, Any]]
   ) -> Tag:
      if isinstance(obj_in, dict):
         update_data = obj_in
      else:
         update_data = obj_in.model_dump(exclude_unset=False)
      if 'keys' in update_data:
         update_data['keys'] = [
            TagApiKeys(api_key=key)
            for key in (update_data.pop('api_keys', []) or [])
         ]
      tag = await super().update(
         db, db_obj=db_obj, obj_in=update_data)
      return tag


tag = CRUDTag(Tag)
