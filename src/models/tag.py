from sqlalchemy import Column, ForeignKey, BigInteger, String  # noqa
from sqlalchemy.orm import relationship
from sqlalchemy.ext.associationproxy import AssociationProxy

from db.base_class import Base  # noqa


class TagApiKeys(Base):
    __table_args__ = {'extend_existing': True}
    tag_id = Column(BigInteger, ForeignKey(
        'tag.id', ondelete='CASCADE'), primary_key=True)
    api_key = Column(String, ForeignKey(
        'api_key.value', ondelete='CASCADE'), primary_key=True)

    tag = relationship('Tag', back_populates='keys')


class Tag(Base):
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey('user.id', ondelete='CASCADE'))
    name = Column(String, index=True)
    color_txt = Column(String, default='#FFFFFF')
    color_bg = Column(String, default='#000000')
    description = Column(String, index=True)

    user = relationship('User', lazy='joined')
    campaigns = relationship('CampaignTags', lazy='joined', join_depth=5)
    keys = relationship(
        'TagApiKeys', lazy='joined',
        cascade='save-update, merge, delete, delete-orphan'
    )
    api_keys = AssociationProxy('keys', 'api_key')
