from datetime import datetime

from sqlalchemy import Column, ForeignKey, Integer, BigInteger, String, DateTime, Index
from sqlalchemy.orm import relationship, dynamic_loader
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.associationproxy import AssociationProxy

from db.base_class import Base


class CampaignApiKeys(Base):
    __table_args__ = {'extend_existing': True}
    campaign_id = Column(BigInteger, ForeignKey(
        'campaign.id', ondelete='CASCADE'), primary_key=True)
    api_key = Column(String, ForeignKey(
        'api_key.value', ondelete='CASCADE'), primary_key=True)

    campaign = relationship('Campaign', back_populates='keys')

class CampaignTags(Base):
    __table_args__ = {'extend_existing': True}
    campaign_id = Column(BigInteger, ForeignKey(
        'campaign.id', ondelete='CASCADE'), primary_key=True)
    tag_id = Column(BigInteger, ForeignKey(
        'tag.id', ondelete='CASCADE'), primary_key=True)

    campaign = relationship('Campaign', back_populates='campaign_tags')
    tag = relationship('Tag', lazy='joined')


class Campaign(Base):
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True, unique=True)
    name = Column(String, index=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'))
    schedule = Column(JSONB, nullable=False, default={})
    msg_template = Column(String, index=True)
    msg_lifespan = Column(Integer, index=True)
    msg_total = Column(Integer, index=True, default=0)
    msg_sent = Column(Integer, index=True, default=0)
    msg_delivered = Column(Integer, index=True, default=0)
    msg_undelivered = Column(Integer, index=True, default=0)
    msg_failed = Column(Integer, index=True, default=0)
    webhook_url = Column(String)
    create_ts = Column(DateTime, index=True, default=datetime.utcnow)
    start_ts = Column(DateTime, index=True)
    stop_ts = Column(DateTime, index=True)
    order = Column(Integer, index=True)
    status  = Column(Integer, index=True)
    user = relationship('User', lazy='joined')

    keys = relationship(
        'CampaignApiKeys', lazy='joined',
        cascade='save-update, merge, delete, delete-orphan'
    )
    api_keys = AssociationProxy('keys', 'api_key')

    campaign_tags = relationship(
        'CampaignTags', lazy='joined',
        cascade='save-update, merge, delete, delete-orphan'
    )
    # tag_ids = AssociationProxy('campaign_tags', 'id')
    tags = AssociationProxy('campaign_tags', 'tag')

    __table_args__ = (
        Index('ix_campaign_schedule_gin', schedule, postgresql_using='gin'),
    )