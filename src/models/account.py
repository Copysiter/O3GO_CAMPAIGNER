import uuid

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, func
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from db.base_class import Base


class Account(Base):
    id = Column(
        Integer, primary_key=True, index=True,
        autoincrement=True, unique=True
    )
    user_id = Column(
        Integer, ForeignKey('user.id', ondelete='CASCADE'), index=True
    )
    uuid = Column(
        UUID(as_uuid=True), default=uuid.uuid4, nullable=False, unique=True
    )
    file_name = Column(String, index=True)
    limit = Column(Integer, nullable=False, default=-1)
    cooldown = Column(Integer, nullable=False, default=0)
    create_ts = Column(DateTime, index=True, default=datetime.utcnow,  server_default=func.now())
    update_ts = Column(DateTime, index=True, onupdate=datetime.utcnow)
    sent = Column(Integer, index=True, default=0)
    status = Column(Integer, index=True, default=0)
    user = relationship('User', lazy='joined')
