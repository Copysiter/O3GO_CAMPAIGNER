from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Column, ForeignKey, Integer, String, Text, DateTime, Float, text as sql_text,
)
from sqlalchemy.orm import relationship

from db.base_class import Base


if TYPE_CHECKING or True:
    from .campaign import Campaign

class CampaignDst(Base):
    id = Column(
        Integer, primary_key=True, index=True,
        autoincrement=True, unique=True
    )
    ext_id = Column(String, index=True)
    campaign_id = Column(
        Integer, ForeignKey('campaign.id', ondelete='CASCADE'), index=True
    )
    src_addr = Column(String, index=True)
    dst_addr = Column(String, index=True)
    field_1 = Column(String, index=True)
    field_2 = Column(String, index=True)
    field_3 = Column(String, index=True)
    field_4 = Column(String, index=True)
    field_5 = Column(String, index=True)
    text = Column(String, index=True)
    reply_text = Column(Text, nullable=True)
    reply_ts = Column(DateTime, nullable=True)
    attempts = Column(Integer, index=True, default=1)
    ban_count = Column(Integer, nullable=False, index=True, default=0, server_default=sql_text("0"))
    status = Column(Integer, index=True, default=0)
    error = Column(String)
    score = Column(Float, index=True)
    create_ts = Column(DateTime, index=True, default=datetime.utcnow)
    expire_ts = Column(DateTime, index=True)
    sent_ts = Column(DateTime, index=True)
    update_ts = Column(DateTime, index=True)

    # campaign = relationship('Campaign', lazy='joined')
