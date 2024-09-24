from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union  # noqa

from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from sqlalchemy import select, func, or_  # noqa
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession

from db.base_class import Base  # noqa


ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get_filters(self, filters: list = None) -> List[Dict]:  # noqa
        filter_list = []
        for i in range(len(filters)):
            if filters[i].get('filters', None):
                if filters[i].get('logic', None) == 'or':
                    filter_list.append(
                        or_(*self.get_filters(filters[i]['filters']))
                    )
                else:
                    filter_list.append(
                        *self.get_filters(filters[i]['filters'])
                    )
                continue
            if filters[i].get('or', None):
                filter_list.append(or_(*self.get_filters(filters[i]['or'])))
                continue
            field = (
                getattr(self.model, filters[i]['field'], None)
                if isinstance(filters[i]['field'], str)
                else filters[i]['field']
            )
            if filters[i]['operator'] == 'eq':
                where = field == filters[i]['value']
            if filters[i]['operator'] == 'neq':
                where = field != filters[i]['value']
            if filters[i]['operator'] == 'istrue':
                where = field == True
            if filters[i]['operator'] == 'isfalse':
                where = field == False
            if filters[i]['operator'] == 'gt':
                where = field > filters[i]['value']
            if filters[i]['operator'] == 'gte':
                where = field >= filters[i]['value']
            if filters[i]['operator'] == 'lt':
                where = field < filters[i]['value']
            if filters[i]['operator'] == 'lte':
                where = field <= filters[i]['value']
            if filters[i]['operator'] == 'startswith':
                where = field.like(f"{filters[i]['value']}%")
            if filters[i]['operator'] == 'endswith':
                where = field.like(f"%{filters[i]['value']}")
            if filters[i]['operator'] == 'contains':
                where = field.like(f"%{filters[i]['value']}%")
            if filters[i]['operator'] == 'doesnotcontain':
                where = field.notlike(f"%{filters[i]['value']}%")
            if filters[i]['operator'] == 'isnull':
                where = field.is_(None)
            if filters[i]['operator'] == 'isnotnull':
                where = field.is_not(None)
            if filters[i]['operator'] == '?':
                where = field.op('?')(filters[i]['value'])
            if filters[i]['operator'] == 'in':
                if None in filters[i]['value']:
                    values = [v for v in filters[i]['value'] if v]
                    where = or_(
                        field.is_(None),
                        field.in_(values)
                    )
                else:
                    where = field.in_(filters[i]['value'])
            if filters[i]['operator'] == 'overlaps':
                where = field.in_(filters[i]['value'])
            if filters[i]['operator'] == 'or':
                where = [or_(field) == value
                         for value in filters[i]['value']]

            if relationship := filters[i].get('relationship'):
                if filters[i]['operator'] == 'overlaps':
                    filter_list.append(relationship.any(where))
                else:
                    filter_list.append(relationship.has(where))
            else:
                filter_list.append(where)

        return filter_list

    def get_orders(self, orders: list = None) -> List[Dict]:
        order_list = []
        for i in range(len(orders)):
            field = (
                getattr(self.model, orders[i]['field'], None)
                if isinstance(orders[i]['field'], str)
                else orders[i]['field']
            )
            if orders[i]['dir'].lower() == 'desc':
                order_list.append(field.desc())
            else:
                order_list.append(field.asc())
        return order_list

    async def get_rows(
        self, db: AsyncSession, *, skip=0, limit=100,
        filters: list = None, orders: list = None
    ) -> List[ModelType]:
        filter_list = self.get_filters(filters) if filters else []
        order_list = self.get_orders(orders) if orders else []
        statement = (select(self.model).
                     where(*filter_list).
                     order_by(*order_list).
                     offset(skip))
        if limit:
            statement = statement.limit(limit)
        results = await db.execute(statement=statement)
        return results.unique().scalars().all()

    async def get_count(
        self, db: AsyncSession, *, filters: dict = None
    ) -> List[ModelType]:
        filter_list = self.get_filters(filters) if filters else []
        statement = (select(func.count(self.model.id)).
                     where(*filter_list))
        results = await db.execute(statement=statement)
        return results.scalar_one()

    async def get(self, db: AsyncSession, id: Any) -> Optional[ModelType]:
        statement = select(self.model).where(self.model.id == id)
        result = await db.execute(statement=statement)
        return result.unique().scalar_one_or_none()

    async def create(
        self, db: AsyncSession, *, obj_in: CreateSchemaType
    ) -> ModelType:
        obj_in_data = obj_in.model_dump()
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self, db: AsyncSession, *, db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        obj_data = obj_in.model_dump()
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: int) -> ModelType:
        statement = select(self.model).where(self.model.id == id)
        result = await db.execute(statement=statement)
        if (db_obj := result.unique().scalar_one_or_none()) is None:
            await db.rollback()
            raise NoResultFound(
                f'{self.model.__name__}(`id`=\'{id}\') does not exist')
        await db.delete(db_obj)
        await db.commit()
        return db_obj
