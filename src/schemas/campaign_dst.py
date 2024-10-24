from typing import Optional, List

from datetime import datetime

from pydantic import BaseModel

from .campaign import Campaign


# Shared properties
class CampaignDstBase(BaseModel):
    campaign_id: Optional[int]
    dst_addr: Optional[int]
    field_1: Optional[str] = None
    field_2: Optional[str] = None
    field_3: Optional[str] = None
    field_4: Optional[str] = None
    field_5: Optional[str] = None
    status: Optional[int] = None
    create_ts: Optional[datetime] = datetime.utcnow()


# Properties to receive on item creation
class CampaignDstCreate(CampaignDstBase):
    campaign_id: int
    dst_addr: int


# Properties to receive on item update
class CampaignDstUpdate(CampaignDstBase):
    sent_ts: Optional[str] = None
    update_ts: Optional[str] = None
    error: Optional[str] = None


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