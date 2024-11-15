from typing import List, Optional
from pydantic import BaseModel

from .user import User


# Shared properties
class ApiKeyBase(BaseModel):
    user_id: Optional[int] = None
    value: str
    description: Optional[str] = None


# Properties to receive via API on creation
class ApiKeyCreate(ApiKeyBase):
    pass


# Properties to receive via API on update
class ApiKeyUpdate(ApiKeyBase):
    pass


class ApiKeyInDBBase(ApiKeyBase):
    id: int

    class Config:
        from_attributes = True


# Additional properties to return via API
class ApiKey(ApiKeyInDBBase):
    user: User


# Additional properties stored in DB
class ApiKeyInDB(ApiKeyInDBBase):
    pass


# List of ApiKeys to return via API
class ApiKeyRows(BaseModel):
    data: List[ApiKey]
    total: int
