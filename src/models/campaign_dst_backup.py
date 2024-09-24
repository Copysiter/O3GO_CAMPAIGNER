from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID

from db.base_class import Base


if TYPE_CHECKING or True:
    from .campaign import Campaign

class CampaignDst(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, unique=True)
    campaign_id = Column(Integer, ForeignKey('campaign.id', ondelete='CASCADE'))
    dst_addr = Column(String, index=True)
    field_1 = Column(String, index=True)
    field_2 = Column(String, index=True)
    field_3 = Column(String, index=True)
    field_4 = Column(String, index=True)
    field_5 = Column(String, index=True)
    msg_id = Column(String, index=True, unique=True)
    msg_sent = Column(Integer, index=True, default=0)
    msg_submitted = Column(Integer, index=True, default=0)
    msg_failed = Column(Integer, index=True, default=0)
    msg_delivered = Column(Integer, index=True, default=0)
    msg_parts = Column(Integer, index=True)
    #sequence = Column(JSONB, nullable=False, default=[])
    #create_ts = Column(Integer)
    sent_ts = Column(DateTime, index=True)
    submit_ts = Column(DateTime, index=True)
    submit_status = Column(Integer, index=True)
    submit_error = Column(String)
    delivery_ts = Column(DateTime, index=True)
    delivery_status = Column(Integer, index=True)
    delivery_error = Column(String)

    campaign = relationship('Campaign', lazy='joined')