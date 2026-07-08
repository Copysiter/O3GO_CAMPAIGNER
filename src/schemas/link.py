from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class LinkShortenRequest(BaseModel):
    urls: List[str]


class LinkShortenRequestWithCampaign(BaseModel):
    campaign_id: int
    urls: List[str]


class LinkShortenResult(BaseModel):
    original: str
    short: Optional[str] = None
    fake: bool = False


class LinkShortenResponse(BaseModel):
    results: List[LinkShortenResult]


class LinkClickItem(BaseModel):
    short: str
    count: int


class LinkClickWebhook(BaseModel):
    links: List[LinkClickItem]


class LinkClickResponse(BaseModel):
    counts: Dict[int, int] = Field(default_factory=dict)
    success: int
    errors: int
