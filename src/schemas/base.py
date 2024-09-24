from typing import Any, List, Literal, Optional  # noqa

from pydantic import BaseModel, UUID4, model_validator  # noqa
from pydantic_core.core_schema import FieldValidationInfo


class Filter(BaseModel):
    field: str
    operator: Literal[
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'startswith', 'endswith',
        'contains', 'doesnotcontain', 'in', 'isnull', 'isnotnull'
    ]
    value: Optional[Any] = None


class Order(BaseModel):
    field: str
    dir: Literal['ASC', 'DESC', 'asc', 'desc']

    @model_validator(mode='after')
    def order_model_dump(cls, info: FieldValidationInfo):  # noqa
        return info.model_dump()
