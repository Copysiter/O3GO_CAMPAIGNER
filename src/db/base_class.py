import re

from typing import Any
from sqlalchemy.orm import as_declarative, declared_attr  # noqa
# from sqlalchemy.ext.declarative import declared_attr  # noqa


@as_declarative()
class Base:
    id: Any
    __name__: str

    # Generate __tablename__ automatically
    @declared_attr
    def __tablename__(cls) -> str:
        # CamelCase -> snake_case
        return '_'.join(re.split(r'(?<=\w)(?=[A-Z])', cls.__name__)).lower()
