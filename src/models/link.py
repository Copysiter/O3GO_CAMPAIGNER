from datetime import datetime
from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, text
from sqlalchemy.orm import relationship

from db.base_class import Base


class Link(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True, unique=True)
    campaign_id = Column(
        Integer,
        ForeignKey("campaign.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    original = Column(String, nullable=False, index=True)
    short = Column(String, nullable=False, index=True)
    clicks = Column(Integer, default=0, server_default=text("0"), index=True)
    created_at = Column(DateTime, index=True, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="links")
