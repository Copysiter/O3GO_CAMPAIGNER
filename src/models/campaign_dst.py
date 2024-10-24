from typing import TYPE_CHECKING, Optional

from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID

from db.base_class import Base


if TYPE_CHECKING or True:
    from .campaign import Campaign

class CampaignDst(Base):
    id = Column(
        Integer, primary_key=True, index=True,
        autoincrement=True, unique=True
    )
    campaign_id = Column(
        Integer, ForeignKey('campaign.id', ondelete='CASCADE')
    )
    dst_addr = Column(String, index=True)
    field_1 = Column(String, index=True)
    field_2 = Column(String, index=True)
    field_3 = Column(String, index=True)
    field_4 = Column(String, index=True)
    field_5 = Column(String, index=True)
    text = Column(String, index=True)
    status = Column(Integer, index=True, default=0)
    error = Column(String)
    create_ts = Column(DateTime, index=True)
    sent_ts = Column(DateTime, index=True)
    update_ts = Column(DateTime, index=True)

    # campaign = relationship('Campaign', lazy='joined')