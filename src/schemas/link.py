from typing import List, Optional
from pydantic import BaseModel


class LinkShortenRequest(BaseModel):
    urls: List[str]


class LinkShortenRequestWithCampaign(BaseModel):
    campaign_id: int
    urls: List[str]


class LinkShortenResult(BaseModel):
    original: str
    short: str


class LinkShortenResponse(BaseModel):
    results: List[LinkShortenResult]


class LinkClickItem(BaseModel):
    short: str
    count: int


class LinkClickWebhook(BaseModel):
    links: List[LinkClickItem]


class LinkClickResponse(BaseModel):
    success: int
    errors: int
