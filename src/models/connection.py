from sqlalchemy import Column, ForeignKey, ARRAY, Text, String, Integer, BigInteger, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import AssociationProxy

from db.base_class import Base

from typing import TYPE_CHECKING


if TYPE_CHECKING or True:
    from .user import User


class ConnectionApiKeys(Base):
    __table_args__ = {'extend_existing': True}
    connection_id = Column(BigInteger, ForeignKey(
        'connection.id', ondelete='CASCADE'), primary_key=True)
    api_key = Column(String, ForeignKey(
        'api_key.value', ondelete='CASCADE'), primary_key=True)

    connection = relationship('Connection', back_populates='keys')


class Connection(Base):
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, index=True)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'))
    login = Column(String, index=True, unique=True)
    password = Column(String, index=True)
    is_active = Column(Boolean(), default=False)
    user = relationship('User', lazy='joined')

    keys = relationship(
        'ConnectionApiKeys', back_populates='connection', lazy='joined',
        cascade='save-update, merge, delete, delete-orphan'
    )
    api_keys = AssociationProxy('keys', 'api_key')
