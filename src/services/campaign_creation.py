"""Create all campaigns belonging to one prepared import atomically."""
from collections import defaultdict
from copy import deepcopy
from datetime import datetime
import logging

from fastapi import HTTPException
from sqlalchemy import insert, select, text
from starlette.concurrency import run_in_threadpool

import crud
import models
import schemas
from core.config import settings
from models.campaign import CampaignApiKeys, CampaignAndroids, CampaignTags
from services.campaign_geo_report import extract_report_link
from services.campaign_import import prepare_import


def creation_result(campaigns, import_id):
    return {
        "import_id": import_id,
        "created_count": len(campaigns),
        "campaigns": [
            {"id": c.id, "name": c.name, "geo": c.geo,
             "msg_total": c.msg_total, "status": c.status}
            for c in campaigns
        ],
    }


def render_message(template, recipient):
    message = template
    for index in range(1, 6):
        key = f"field_{index}"
        if recipient.get(key) is not None:
            message = message.replace("{" + key + "}", str(recipient[key]))
    return message


async def create_from_import(db, user, request):
    """Returns (public result, post-commit jobs). The upload UUID is the retry key."""
    if not user.is_superuser and "campaign.manage" not in user.permissions:
        raise HTTPException(403, "Недостаточно прав для создания кампаний")
    owner_id = request.user_id or user.id
    if owner_id != user.id and not user.is_superuser:
        raise HTTPException(403, "Нельзя создать кампанию другого пользователя")
    if request.split_by_geo and request.clicker_url:
        raise HTTPException(422, "Clicker доступен при создании одной кампании без разделения по GEO")
    if request.auto_shorten_links and not (
        user.is_superuser or "campaign.auto_shorten_links" in user.permissions
    ):
        raise HTTPException(403, "Недостаточно прав для автоматического сокращения ссылок")

    try:
        # Same import cannot be consumed concurrently. No global serialization.
        if db.bind.dialect.name == "postgresql":
            lock_key = int.from_bytes(request.import_id.bytes[:8], "big", signed=True)
            await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
        existing = (await db.execute(
            select(models.Campaign).where(models.Campaign.import_id == request.import_id)
            .order_by(models.Campaign.id)
        )).unique().scalars().all()
        if existing:
            if not user.is_superuser and any(c.user_id != user.id for c in existing):
                raise HTTPException(404, "Загрузка не найдена")
            result = creation_result(existing, request.import_id)
            await db.commit()
            return result, []

        prepared = await run_in_threadpool(
            prepare_import, request.import_id, user.id,
            request.mappings, request.default_region,
        )
        if prepared["invalid_count"] and not request.exclude_invalid:
            raise HTTPException(422, "Исправьте ошибочные строки или включите их исключение")
        recipients = prepared["rows"]
        if not recipients:
            raise HTTPException(422, "В загрузке нет корректных номеров")
        template = request.msg_template if request.msg_template is not None else prepared.get("message") or ""
        if not template.strip():
            raise HTTPException(422, "Укажите сообщение кампании")
        name = request.name.strip()
        if not name:
            raise HTTPException(422, "Укажите название кампании")

        owner = await crud.user.get(db, id=owner_id)
        if not owner:
            raise HTTPException(422, "Владелец кампании не найден")

        tags = []
        if request.tags:
            if not user.is_superuser and "campaign.assign_tags" not in user.permissions:
                raise HTTPException(403, "Недостаточно прав для назначения тегов")
            statement = select(models.Tag).where(models.Tag.id.in_(request.tags))
            if not user.is_superuser:
                statement = statement.where(models.Tag.user_id == user.id)
            tags = (await db.execute(statement)).unique().scalars().all()
            if len(tags) != len(set(request.tags)):
                raise HTTPException(422, "Один из выбранных тегов недоступен")

        can_assign_keys = user.is_superuser or "campaign.assign_api_keys" in user.permissions
        keys = list(dict.fromkeys((request.api_keys if can_assign_keys else owner.api_keys) or []))
        if keys:
            statement = select(models.ApiKey).where(models.ApiKey.value.in_(keys))
            if not user.is_superuser:
                statement = statement.where(models.ApiKey.user_id == user.id)
            allowed = (await db.execute(statement)).unique().scalars().all()
            if len(allowed) != len(keys):
                raise HTTPException(422, "Один из выбранных API-ключей недоступен")
        all_keys = set(keys)
        for tag in tags:
            all_keys.update(tag.api_keys)
        if request.androids and not (
            user.is_superuser or "campaign.assign_androids" in user.permissions
        ):
            raise HTTPException(403, "Недостаточно прав для назначения устройств")

        grouped = defaultdict(list)
        for recipient in recipients:
            grouped[recipient.get("geo") if request.split_by_geo else None].append(recipient)

        # Import here to avoid tasks -> schemas -> services circular imports.
        from api.v1.endpoints.campaigns import mark_links_for_shortening, extract_links
        created, jobs = [], []
        ts = datetime.utcnow()
        for geo, rows in sorted(grouped.items(), key=lambda item: item[0] or "ZZZ"):
            campaign = models.Campaign(
                name=f"[{(geo or 'unknown').lower()}] {name}" if request.split_by_geo else name,
                import_id=request.import_id, geo=geo,
                user_id=owner_id, schedule=deepcopy(request.schedule or {}),
                msg_template=template, msg_attempts=request.msg_attempts,
                msg_sending_timeout=request.msg_sending_timeout,
                msg_status_timeout=request.msg_status_timeout,
                msg_total=len(rows), msg_sent=0, msg_delivered=0,
                msg_undelivered=0, msg_failed=0, follow_count=0,
                link_clicks=0, fake_clicks=0,
                follow_limit=request.follow_limit or 0,
                webhook_url=request.webhook_url, order=request.order or 0,
                create_ts=ts, start_ts=request.start_ts, stop_ts=request.stop_ts,
                status=schemas.CampaignStatus.CREATED,
                keys=[CampaignApiKeys(api_key=key) for key in sorted(all_keys)],
                campaign_androids=[CampaignAndroids(device=device) for device in dict.fromkeys(request.androids or [])],
                campaign_tags=[CampaignTags(tag_id=tag.id) for tag in tags],
            )
            db.add(campaign)
            await db.flush()
            message_rows = []
            has_links = False
            for recipient in rows:
                message = render_message(template, recipient)
                original_link = extract_report_link(message)
                if request.auto_shorten_links:
                    message = mark_links_for_shortening(message)
                has_links = has_links or bool(extract_links(message, recipient))
                message_rows.append({
                    "campaign_id": campaign.id, "dst_addr": recipient["dst_addr"],
                    "geo": recipient.get("geo"), "link": original_link,
                    "text": message, "attempts": request.msg_attempts,
                    "create_ts": ts, "expire_ts": None,
                    **{f"field_{i}": recipient.get(f"field_{i}") for i in range(1, 6)},
                })
            steps = (["shorten_links"] if has_links else [])
            if request.rewrite and request.provider:
                steps.append("rewrite")
            message_status = schemas.CampaignDstStatus.WAITING if steps else schemas.CampaignDstStatus.CREATED
            check_rows = []
            for start in range(0, len(message_rows), settings.DATABASE_INSERT_BATCH_SIZE):
                batch = message_rows[start:start + settings.DATABASE_INSERT_BATCH_SIZE]
                for message_row in batch:
                    message_row["status"] = message_status
                inserted = await db.execute(
                    insert(models.CampaignDst).returning(models.CampaignDst.id, models.CampaignDst.dst_addr), batch,
                )
                check_rows.extend({"id": row.id, "phone": row.dst_addr} for row in inserted)
            created.append(campaign)
            jobs.append({"campaign_id": campaign.id, "steps": steps, "check_rows": check_rows})

        result = creation_result(created, request.import_id)
        await db.commit()
        return result, jobs
    except Exception:
        await db.rollback()
        raise


def dispatch_import_jobs(jobs, request, x_api_key):
    """Called after commit; never turn a successfully saved import into an HTTP error."""
    from celery import group
    from tasks import prepare_campaign, check_dst_batch
    rewrite_config = None
    if request.rewrite and request.provider:
        provider = request.provider.lower()
        rewrite_config = {
            "provider": request.provider, "model": request.model,
            "api_key": settings.AI_OLLAMA_API_KEY if provider == "ollama" else settings.AI_OPENROUTER_API_KEY,
            "prompt": request.prompt or settings.AI_REWRITE_SYSTEM_PROMPT,
        }
    for job in jobs:
        try:
            if job["steps"]:
                prepare_campaign.delay(
                    campaign_id=job["campaign_id"], steps=job["steps"],
                    x_api_key=x_api_key, unique_shorten_link=request.unique_shorten_link,
                    rewrite_config=rewrite_config,
                )
            if request.check_dst:
                rows = job["check_rows"]
                group(*[
                    check_dst_batch.si(rows[start:start + settings.PHONE_CHECKER_BATCH_SIZE])
                    for start in range(0, len(rows), settings.PHONE_CHECKER_BATCH_SIZE)
                ]).apply_async()
        except Exception:
            logging.exception("Could not schedule preparation for imported campaign %s", job["campaign_id"])
