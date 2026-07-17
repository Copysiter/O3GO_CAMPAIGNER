from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class LinkShortenItem(BaseModel):
    url: str
    ext_id: int
    dst_addr: Optional[str] = None


class LinkShortenRequest(BaseModel):
    x_api_key: str
    urls: List[LinkShortenItem] = Field(min_length=1, max_length=500)


class LinkShortenResult(LinkShortenItem):
    new_url: str


class LinkCreate(BaseModel):
    campaign_id: int
    original: str
    short: Optional[str] = None
    dst_addr: Optional[str] = None
    fake: bool = False


class LinkClickItem(BaseModel):
    short: str
    ext_id: int
    dst_addr: Optional[str] = None
    count: int


class LinkClickWebhook(BaseModel):
    links: List[LinkClickItem]


class LinkClickResponse(BaseModel):
    counts: Dict[int, int] = Field(default_factory=dict)
    success: int
    errors: int
