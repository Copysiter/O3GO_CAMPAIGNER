from sqlalchemy import Boolean, Column, ForeignKey, Integer, BigInteger, String  # noqa
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import AssociationProxy

from db.base_class import Base  # noqa


class UserApiKeys(Base):
    __table_args__ = {'extend_existing': True}
    user_id = Column(BigInteger, ForeignKey(
        'user.id', ondelete='CASCADE'), primary_key=True)
    api_key = Column(String, ForeignKey(
        'api_key.value', ondelete='CASCADE'), primary_key=True)

    user = relationship('User', back_populates='keys')


class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(125), index=True)
    login = Column(String(125), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean(), default=True)
    is_superuser = Column(Boolean(), default=False)

    keys = relationship(
        'UserApiKeys', back_populates='user', lazy='joined',
        cascade='save-update, merge, delete, delete-orphan'
    )
    api_keys = AssociationProxy('keys', 'api_key')
