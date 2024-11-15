from typing import List, Optional

from pydantic import BaseModel


# Shared properties
class UserBase(BaseModel):
    name: Optional[str] = None
    login: Optional[str] = None
    ext_api_key: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: bool = False


# Properties to receive via API on creation
class UserCreate(UserBase):
    login: str
    password: str
    api_keys: list = []


# Properties to receive via API on update
class UserUpdate(UserBase):
    password: Optional[str] = None
    api_keys: list = []


class UserInDBBase(UserBase):
    id: Optional[int] = None

    class Config:
        from_attributes = True


# Additional properties to return via API
class User(UserInDBBase):
    api_keys: list = []


# Additional properties stored in DB
class UserInDB(UserInDBBase):
    hashed_password: str


# List of users to return via API
class UserRows(BaseModel):
    data: List[User]
    total: int
