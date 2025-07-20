from crud.base import CRUDBase
from models.android import Android
from schemas.android import AndroidCreate, AndroidUpdate


class CRUDAndroid(CRUDBase[Android, AndroidCreate, AndroidUpdate]):
    pass


android = CRUDAndroid(Android)
