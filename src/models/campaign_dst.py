from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, ForeignKey, Integer, String, DateTime
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
        Integer, ForeignKey('campaign.id', ondelete='CASCADE')
    )
    dst_addr = Column(String, index=True)
    field_1 = Column(String, index=True)
    field_2 = Column(String, index=True)
    field_3 = Column(String, index=True)
    field_4 = Column(String, index=True)
    field_5 = Column(String, index=True)
    text = Column(String, index=True)
    attempts = Column(Integer, index=True, default=1)
    status = Column(Integer, index=True, default=0)
    error = Column(String)
    create_ts = Column(DateTime, index=True, default=datetime.utcnow)
    expire_ts = Column(DateTime, index=True)
    sent_ts = Column(DateTime, index=True)
    update_ts = Column(DateTime, index=True)

    # campaign = relationship('Campaign', lazy='joined')