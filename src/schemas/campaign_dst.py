from typing import Optional, List

from datetime import datetime

from pydantic import BaseModel

from .campaign import Campaign


# Shared properties
class CampaignDstBase(BaseModel):
    ext_id: Optional[str]
    campaign_id: Optional[int]
    src_addr: Optional[str] = None
    dst_addr: Optional[int]
    text: Optional[str] = None
    field_1: Optional[str] = None
    field_2: Optional[str] = None
    field_3: Optional[str] = None
    field_4: Optional[str] = None
    field_5: Optional[str] = None
    attempts: Optional[int] = None
    status: Optional[int] = None
    create_ts: Optional[datetime] = datetime.utcnow()
    sent_ts: Optional[datetime] = None
    update_ts: Optional[datetime] = None
    expire_ts: Optional[datetime] = None
    error: Optional[str] = None


# Properties to receive on item creation
class CampaignDstCreate(CampaignDstBase):
    campaign_id: int
    dst_addr: int


# Properties to receive on item update
class CampaignDstUpdate(CampaignDstBase):
    pass


# Properties shared by models stored in DB
class CampaignDstInDBBase(CampaignDstBase):
    id: int
    
    class Config:
        from_attributes = True


# Properties to return to client
class CampaignDst(CampaignDstInDBBase):
    pass


# Properties stored in DB
class CampaignDstInDB(CampaignDstInDBBase):
    pass

# List to return to client
class CampaignDstRows(BaseModel):
    data: List[CampaignDst]
    total: int = 0