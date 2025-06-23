from sqlalchemy import Column, ForeignKey, BigInteger, String  # noqa
from sqlalchemy.orm import relationship

from db.base_class import Base  # noqa


class ApiKey(Base):
    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(
        BigInteger, ForeignKey(
            'user.id', ondelete='CASCADE'
        ), index=True
    )
    value = Column(String, index=True, unique=True)
    description = Column(String, index=True)

    user = relationship('User', lazy='joined')

