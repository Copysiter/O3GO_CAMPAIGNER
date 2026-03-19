from datetime import datetime, timedelta
from typing import Union, Any, Dict, List

from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.tag import Tag
from models.campaign import (
    Campaign, CampaignApiKeys, CampaignAndroids, CampaignTags
)
from models.campaign_dst import CampaignDst
from schemas.campaign import CampaignCreate, CampaignUpdate
from schemas.status import CampaignDstStatus
from services.android import AndroidService


class CRUDCampaign(CRUDBase[Campaign, CampaignCreate, CampaignUpdate]):
    async def get_rows_by_user(
        self, db: AsyncSession, *, user_id: int,
        filters: list = None, orders: list = None,
        skip: int = 0, limit: int = 100,
    ) -> List[Campaign]:
        filter_list = self.get_filters(filters) if filters else []
        order_list = self.get_orders(orders) if orders else []
        statement = (select(Campaign).
                     where(Campaign.user_id == user_id).
                     where(*filter_list).order_by(*order_list).
                     offset(skip).limit(limit))
        results = await db.execute(statement=statement)
        campaigns = results.unique().scalars().all()
        for campaign in campaigns:
            campaign.campaign_tags = [
                campaign_tag for campaign_tag in campaign.campaign_tags if
                campaign_tag.tag.user_id == user_id
            ]
            campaign.keys = [
                api_key for api_key in campaign.keys if
                api_key.key.user_id == user_id
            ]
            campaign.api_keys = [key.api_key for key in campaign.keys]
        return campaigns

    async def get_count_by_user(
        self, db: AsyncSession, *, user_id: int, filters: dict = None
    ) -> int:
        filter_list = self.get_filters(filters) if filters else []
        statement = (select(func.count(self.model.id)).
                     where(self.model.user_id == user_id).
                     where(*filter_list))
        results = await db.execute(statement=statement)
        return results.scalar_one()

    def prepare_api_keys(
        self, api_keys: list = None, tags: list = None,
        removed_keys: list = None
    ) -> list:
        """
        Подготавливает список CampaignApiKeys на основе api_keys и tags
        
        Args:
            api_keys: Список строк с api ключами
            tags: Список объектов Tag или None
            removed_keys: Список ключей для исключения
            
        Returns:
            list: Список объектов CampaignApiKeys
        """
        result_keys = set(api_keys or [])

        # Добавляем ключи из тегов
        if tags:
            for tag in tags:
                for key in tag.keys:
                    result_keys.add(key.api_key)

        # Удаляем ключи из removed_keys
        if removed_keys:
            result_keys = result_keys - set(removed_keys)

        # Возвращаем список моделей CampaignApiKeys
        return [CampaignApiKeys(api_key=key) for key in result_keys]

    async def create(
        self, db: AsyncSession, *, obj_in: CampaignCreate
    ) -> Campaign:
        if isinstance(obj_in, dict):
            obj_in_data = obj_in
        else:
            obj_in_data = obj_in.model_dump(exclude_unset=True)

        # Загружаем полные объекты Tag из БД
        tag_ids = obj_in_data.pop('tags', []) or []
        loaded_tags = []
        if tag_ids:
            statement = select(Tag).where(Tag.id.in_(tag_ids))
            result = await db.execute(statement)
            loaded_tags = result.unique().scalars().all()

        # Подготавливаем campaign_tags
        obj_in_data['campaign_tags'] = [
            CampaignTags(tag_id=tag.id)
            for tag in loaded_tags
        ]

        # Используем prepare_api_keys для подготовки ключей
        obj_in_data['keys'] = self.prepare_api_keys(
            api_keys=obj_in_data.pop('api_keys', []) or [],
            tags=loaded_tags
        )
        
        campaign = await super().create(db, obj_in=obj_in_data)
        return campaign

    async def update(
        self, db: AsyncSession, *, db_obj: Campaign,
        obj_in: Union[CampaignUpdate, Dict[str, Any]]
    ) -> Campaign:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        loaded_tags = []

        # Обработка tags
        if 'tags' in update_data:
            tag_ids = update_data.pop('tags') or []
            if tag_ids:
                statement = select(Tag).where(Tag.id.in_(tag_ids))
                result = await db.execute(statement)
                loaded_tags = result.unique().scalars().all()

            update_data['campaign_tags'] = [
                CampaignTags(tag_id=tag.id)
                for tag in loaded_tags
            ]

        # Обработка api_keys
        if 'tags' in update_data or 'api_keys' in update_data:
            # Определяем, какие api_keys использовать
            if 'api_keys' in update_data:
                # Если api_keys переданы явно
                api_keys = update_data.pop('api_keys') or []
            else:
                # Если api_keys не переданы, берём из БД
                api_keys = [key.api_key for key in db_obj.keys]

            # Если tags тоже обновляются, используем их, иначе None
            update_data['keys'] = self.prepare_api_keys(
                api_keys=api_keys, tags=loaded_tags
            )

        if 'msg_attempts' in update_data and \
                db_obj.msg_attempts != update_data['msg_attempts']:
            statement = update(CampaignDst).where(
                CampaignDst.campaign_id == db_obj.id,
                CampaignDst.status.not_in([
                    CampaignDstStatus.DELIVERED,
                    CampaignDstStatus.UNDELIVERED
                ])
            ).values(attempts=update_data['msg_attempts'])
            await db.execute(statement)

        if 'msg_sending_timeout' in update_data and \
            db_obj.msg_sending_timeout != \
                update_data['msg_sending_timeout']:
            statement = update(CampaignDst).where(
                CampaignDst.campaign_id == db_obj.id,
                CampaignDst.status == CampaignDstStatus.CREATED
            ).values(
                expire_ts=(datetime.utcnow() + timedelta(
                    seconds=update_data['msg_sending_timeout']
                )) if update_data['msg_sending_timeout'] else None
            )
            await db.execute(statement)

        campaign = await super().update(db, db_obj=db_obj, obj_in=update_data)

        # Загружаем имена Android устройств из внешнего сервиса
        if campaign.androids and campaign.user and campaign.user.ext_api_key:
            android = AndroidService()

            data = await android.get_device_options(
                x_api_key=campaign.user.ext_api_key)

            # Создаём словарь для быстрого маппинга value -> text
            android_map = {
                item['value']: item['text'] for item in data
                if 'value' in item and 'text' in item
            }

            # Обогащаем кампанию полем android_names
            campaign.android_names = [
                android_map.get(android_id, android_id)
                for android_id in campaign.androids
            ]
        else:
            campaign.android_names = []

        return campaign

    async def update_rows(
        self, db: AsyncSession, *, ids: List[int],
        obj_in: Dict[str, Any], user_id: int = None
    ) -> List[Campaign]:
        statement = update(self.model).where(self.model.id.in_(ids))
        if user_id is not None:
            statement = statement.where(Campaign.user_id == user_id)
        statement = statement.values(**obj_in).returning(self.model)
        results = await db.execute(statement=statement)
        await db.commit()

        campaigns = results.unique().scalars().all()

        # Обогащаем каждую кампанию полем android_names
        for campaign in campaigns:
            if campaign.androids and campaign.user and campaign.user.ext_api_key:
                android = AndroidService()
                data = await android.get_device_options(
                    x_api_key=campaign.user.ext_api_key
                )

                # Создаём словарь для быстрого маппинга value -> text
                android_map = {
                    item['value']: item['text'] for item in data
                    if 'value' in item and 'text' in item
                }

                # Обогащаем кампанию полем android_names
                campaign.android_names = [
                    android_map.get(android_id, android_id)
                    for android_id in campaign.androids
                ]
            else:
                campaign.android_names = []

        return campaigns

    async def delete_rows(
        self, db: AsyncSession, *, ids: List[int], user_id: int = None
    ) -> List[int]:
        statement = delete(Campaign).where(Campaign.id.in_(ids))
        if user_id is not None:
            statement = statement.where(Campaign.user_id == user_id)
        statement = statement.returning(Campaign.id)
        result = await db.execute(statement=statement)
        await db.commit()
        r = result.scalars().all()
        return r

    async def link_click(
        self, db: AsyncSession, *, counts: Dict[int, int]
    ) -> None:
        """
        Атомарно инкрементировать счетчик link_clicks для кампаний.

        Args:
            db: Сессия БД
            counts: Словарь {campaign_id: increment_count}
        """
        for campaign_id, count in counts.items():
            stmt = (
                update(Campaign)
                .where(Campaign.id == campaign_id)
                .values(link_clicks=Campaign.link_clicks + count)
            )
            await db.execute(stmt)

        await db.commit()


campaign = CRUDCampaign(Campaign)