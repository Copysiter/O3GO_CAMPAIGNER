from crud.base import CRUDBase  # noqa
from models.tag import Tag  # noqa
from schemas.tag import TagCreate, TagUpdate  # noqa


class CRUDTag(CRUDBase[Tag, TagCreate, TagUpdate]):
   pass


tag = CRUDTag(Tag)
