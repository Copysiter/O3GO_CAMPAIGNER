from sqlalchemy import Boolean, Column, ForeignKey, BigInteger, String, Index
from sqlalchemy.orm import relationship

from db.base_class import Base


class UserPermission(Base):
    __table_args__ = (
        Index('user_permission_permission_id', 'permission_id'),
        {'extend_existing': True},
    )

    user_id = Column(
        BigInteger,
        ForeignKey('user.id', ondelete='CASCADE'),
        primary_key=True,
    )
    permission_id = Column(
        BigInteger,
        ForeignKey('permission.id', ondelete='CASCADE'),
        primary_key=True,
    )

    user = relationship('User', back_populates='permission_links')
    permission = relationship('Permission', lazy='joined')


class Permission(Base):
    id = Column(BigInteger, primary_key=True, index=True)
    key = Column(String(125), unique=True, index=True, nullable=False)
    name = Column(String(125), nullable=False)
    description = Column(String)
    is_active = Column(Boolean(), default=True, index=True)

    user_links = relationship(
        'UserPermission',
        lazy='selectin',
    )
