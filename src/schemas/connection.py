from typing import Optional, List

from pydantic import BaseModel

from .user import User


# Shared properties
class ConnectionBase(BaseModel):
    user_id: Optional[int]
    name: Optional[str]
    login: Optional[str]
    password: Optional[str]
    is_active: Optional[bool] = True


# Properties to receive on item creation
class ConnectionCreate(ConnectionBase):
    user_id: int
    login: str
    password: str
    api_keys: list = []


# Properties to receive on item update
class ConnectionUpdate(ConnectionBase):
    api_keys: list = []


# Properties shared by models stored in DB
class ConnectionInDBBase(ConnectionBase):
    id: int
    
    class Config:
        from_attributes = True


# Properties to return to client
class Connection(ConnectionInDBBase):
    user: User
    api_keys: list = []


# Properties properties stored in DB
class ConnectionInDB(ConnectionInDBBase):
    pass


# List to return to client
class ConnectionRows(BaseModel):
    data: List[Connection]
    total: int = 0