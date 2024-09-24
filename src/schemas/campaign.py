from optparse import Option
from typing import Optional, List, Union

from datetime import datetime

from pydantic import BaseModel

from .user import User


# Shared properties
class CampaignBase(BaseModel):
    name: Optional[str] = None
    user_id: Optional[int] = None
    connection_id: Optional[int] = None
    schedule: Optional[dict] = {
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
        6: [],
        7: []
    }
    msg_template: Optional[str] = None
    msg_total: Optional[int] = 0
    msg_sent: Optional[int] = 0
    msg_delivered: Optional[int] = 0
    msg_failed: Optional[int] = 0
    status_id: Optional[int] = 0
    create_ts: Optional[datetime] = datetime.utcnow()
    start_ts: Optional[datetime] = None
    stop_ts: Optional[datetime] = None
    api_keys: Optional[list] = []


# Properties to receive on item creation
class CampaignCreate(CampaignBase):
    # data_file_upload:  Optional[bool] = False
    data_file_name: Optional[str] = None
    data_text: Optional[str] = None
    data_text_row_sep: Optional[str] = '\n'
    data_text_col_sep: Optional[str] = ';'
    data_text_row_skip: Optional[int] = 0
    data_fields: Optional[dict] = {
        'dst_addr' : 0,
        'field_1': 1,
        'field_2': 2,
        'field_3': 3
    }
    keys: Optional[list] = []
    api_keys: list = []


# Properties to receive on item update
class CampaignUpdate(CampaignBase):
    keys: Optional[list] = []
    api_keys: list = []


# Properties shared by models stored in DB
class CampaignInDBBase(CampaignBase):
    id: int
    
    class Config:
        from_attributes = True


# Properties to return to client
class Campaign(CampaignInDBBase):
    user: User
    api_keys: list = []

# Properties stored in DB
class CampaignInDB(CampaignInDBBase):
    pass

# List to return to client
class CampaignRows(BaseModel):
    data: List[Campaign]
    total: int = 0