from numpy.ma.extras import unique
from sqlalchemy import Column, BigInteger, String  # noqa

from db.base_class import Base  # noqa


class ApiKey(Base):
    id = Column(BigInteger, primary_key=True, index=True)
    value = Column(String, index=True, unique=True)
