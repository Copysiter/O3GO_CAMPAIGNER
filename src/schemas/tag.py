from typing import List, Optional
from pydantic import BaseModel


# Shared properties
class TagBase(BaseModel):
    name: str
    color_txt: Optional[str]
    color_bg: Optional[str]


# Properties to receive via API on creation
class TagCreate(TagBase):
    name: str


# Properties to receive via API on update
class TagUpdate(TagBase):
    pass


class TagInDBBase(TagBase):
    id: int

    class Config:
        from_attributes = True


# Additional properties to return via API
class Tag(TagInDBBase):
    pass


# Additional properties stored in DB
class TagInDB(TagInDBBase):
    pass


# List of Tags to return via API
class TagRows(BaseModel):
    data: List[Tag]
    total: int
