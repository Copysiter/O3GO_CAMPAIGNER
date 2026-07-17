from typing import Any, Dict, List
from sqlalchemy import select, tuple_, update
from sqlalchemy.ext.asyncio import AsyncSession

from crud.base import CRUDBase
from models.link import Link
from schemas.link import LinkClickItem, LinkCreate
from core.config import settings


class CRUDLink(CRUDBase[Link, LinkCreate, LinkCreate]):
    async def insert(
        self,
        db: AsyncSession,
        *,
        results: List[LinkCreate],
    ) -> List[Link]:
        """Create generated links without collapsing recipient-specific rows."""
        links = [Link(**item.model_dump()) for item in results]
        db.add_all(links)
        await db.flush()

        return links

    async def get_clicked_pairs(
        self,
        db: AsyncSession,
        *,
        campaign_dsts: List[Any],
    ) -> set[tuple[int, str]]:
        """Return campaign/recipient pairs with at least one clicked link."""
        pairs = {
            (dst.campaign_id, dst.dst_addr)
            for dst in campaign_dsts
            if dst.campaign_id is not None and dst.dst_addr
        }
        if not pairs:
            return set()

        statement = (
            select(Link.campaign_id, Link.dst_addr)
            .where(
                tuple_(Link.campaign_id, Link.dst_addr).in_(list(pairs)),
                Link.clicks > 0,
            )
            .distinct()
        )
        result = await db.execute(statement)
        return {
            (row.campaign_id, row.dst_addr)
            for row in result.all()
        }

    async def click(
        self,
        db: AsyncSession,
        *,
        items: List[LinkClickItem],
    ) -> Dict[str, Any]:
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
                dst_addr_filter = (
                    Link.dst_addr.is_(None)
                    if item.dst_addr is None
                    else Link.dst_addr == item.dst_addr
                )

                # UPDATE с RETURNING для получения campaign_id
                stmt = (
                    update(Link)
                    .where(
                        Link.short == item.short,
                        Link.campaign_id == item.ext_id,
                        dst_addr_filter,
                    )
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
