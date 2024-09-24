from typing import List, Optional

from pydantic import BaseModel

from .user import User


# Shared properties
class WebhookRequest(BaseModel):
    api_key: Optional[str] = None
    device_id: Optional[str] = None
    root: Optional[bool] = None
    operator: Optional[str] = None
    service: Optional[str] = None
    status: Optional[str] = None
    proxy: Optional[str] = None
    proxy_status: Optional[str] = None
    number: Optional[str] = None
    info_1: Optional[str] = None
    info_2: Optional[str] = None
    info_3: Optional[str] = None


class WebhookResponse(BaseModel):
    task_id: Optional[str] = None
