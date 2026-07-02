from typing import List, Optional

from pydantic import BaseModel


class PermissionBase(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = True


class PermissionCreate(PermissionBase):
    key: str
    name: str


class PermissionUpdate(PermissionBase):
    pass


class PermissionInDBBase(PermissionBase):
    id: int

    class Config:
        from_attributes = True


class Permission(PermissionInDBBase):
    pass


class PermissionInDB(PermissionInDBBase):
    pass


class PermissionRows(BaseModel):
    data: List[Permission]
    total: int
