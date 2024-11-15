from sqlalchemy import Column, ForeignKey, BigInteger, String  # noqa
from sqlalchemy.orm import relationship

from db.base_class import Base  # noqa


class Tag(Base):
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey('user.id', ondelete='CASCADE'))
    name = Column(String, index=True)
    color_txt = Column(String, default='#FFFFFF')
    color_bg = Column(String, default='#000000')
    description = Column(String, index=True)

    user = relationship('User', lazy='joined')
