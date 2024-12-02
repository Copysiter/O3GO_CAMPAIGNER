from typing import Optional, Union
from pydantic import BaseModel


# Shared properties
class MessageBase(BaseModel):
    id: Optional[int] = None
    dst_addr: Optional[Union[str, int]] = None
    text: Optional[str] = None
    campaign_id: Optional[int] = None


# Properties to receive on message creation
class MessageCreate(MessageBase):
    campaign_id: int
    dst_addr:  Union[str, int]
    field_1: Optional[str] = None
    field_2: Optional[str] = None
    field_3: Optional[str] = None


# Message properties to return to client
class Message(MessageBase):
    id: int
    dst_addr: Union[str, int]
    text: str
    status: Optional[str] = None