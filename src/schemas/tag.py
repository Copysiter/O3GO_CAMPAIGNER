from typing import List, Optional
from pydantic import BaseModel

from .user import User


# Shared properties
class TagBase(BaseModel):
    name: str
    user_id: Optional[int] = None
    color_txt: Optional[str] = None
    color_bg: Optional[str] = None
    description: Optional[str] = None
    api_keys: Optional[list] = []


# Properties to receive via API on creation
class TagCreate(TagBase):
    name: str
    keys: Optional[list] = []
    api_keys: Optional[list] = []


# Properties to receive via API on update
class TagUpdate(TagBase):
    keys: Optional[list] = []
    api_keys: Optional[list] = []


class TagInDBBase(TagBase):
    id: int

    class Config:
        from_attributes = True


# Additional properties to return via API
class Tag(TagInDBBase):
    user: User


# Additional properties stored in DB
class TagInDB(TagInDBBase):
    pass


# List of Tags to return via API
class TagRows(BaseModel):
    data: List[Tag]
    total: int
