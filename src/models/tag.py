from sqlalchemy import Column, BigInteger, String  # noqa

from db.base_class import Base  # noqa


class Tag(Base):
    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String, index=True)
    color_txt = Column(String, default='#FFFFFF')
    color_bg = Column(String, default='#000000')
