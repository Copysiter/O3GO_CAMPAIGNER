from typing import List, Dict
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.link import Link
from schemas.link import LinkShortenResult, LinkClickItem
from core.config import settings


class CRUDLink(CRUDBase[Link, LinkShortenResult, LinkShortenResult]):
    async def insert(
        self,
        db: AsyncSession,
        *,
        campaign_id: int,
        results: List[dict],
        fake: bool = False,
    ) -> List[Link]:
        """
        Массово создать записи о сокращённых ссылках.

        Args:
            db: Сессия БД
            campaign_id: ID кампании
            results: Список словарей [{"original": str, "short": str}, ...]

        Returns:
            Список созданных объектов Link
        """
        links = []
        for item in results:
            # Проверяем, не существует ли уже такая ссылка
            existing = await self.get_by(
                db, campaign_id=campaign_id, original=item["original"], fake=fake
            )

            if existing:
                # Если ссылка уже существует, используем её
                links.append(existing)
            else:
                # Создаём новую запись
                link = Link(
                    campaign_id=campaign_id,
                    original=item["original"],
                    short=item.get("short"),
                    fake=fake,
                )
                db.add(link)
                links.append(link)

        await db.commit()

        # Обновляем объекты после коммита, чтобы получить ID
        for link in links:
            await db.refresh(link)

        return links

    async def click(
        self,
        db: AsyncSession,
        *,
        items: List[LinkClickItem],
    ) -> Dict[str, any]:
        """
        Массово инкрементировать счетчики кликов по ссылкам.

        Args:
            db: Сессия БД
            items: Список объектов LinkClickItem с полями short и count

        Returns:
            Словарь с агрегированными данными по campaign_id:
            {
                "counts": {campaign_id: total_count, ...},       # все ссылки
                "link_counts": {campaign_id: total_count, ...},  # fake=False
                "fakes": {campaign_id: total_count, ...},        # fake=True
                "success": количество успешно обработанных ссылок,
                "errors": количество не найденных ссылок
            }
        """
        counts = {}
        link_counts = {}
        fakes = {}
        success = 0
        errors = 0
        batch_size = settings.DATABASE_UPDATE_BATCH_SIZE

        # Обрабатываем батчами
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]

            for item in batch:
                # UPDATE с RETURNING для получения campaign_id
                stmt = (
                    update(Link)
                    .where(Link.short == item.short)
                    .values(clicks=Link.clicks + item.count)
                    .returning(Link.id, Link.campaign_id, Link.fake, Link.clicks)
                )

                result = await db.execute(stmt)
                row = result.fetchone()

                if row:
                    # Агрегируем инкременты по campaign_id
                    campaign_id = row.campaign_id
                    if campaign_id not in counts:
                        counts[campaign_id] = 0
                    counts[campaign_id] += item.count
                    success += 1

                    if row.fake:
                        if campaign_id not in fakes:
                            fakes[campaign_id] = 0
                        fakes[campaign_id] += item.count
                    else:
                        if campaign_id not in link_counts:
                            link_counts[campaign_id] = 0
                        link_counts[campaign_id] += item.count
                else:
                    errors += 1

            await db.commit()

        return {
            "counts": counts,
            "link_counts": link_counts,
            "fakes": fakes,
            "success": success,
            "errors": errors,
        }


link = CRUDLink(Link)
