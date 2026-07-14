from __future__ import annotations

from typing import Any, Optional
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import models, schemas
from utils.text import safe_replace
from tasks import webhook


# ===================== SQL =====================

SQL_GET_NEXT_BY_CAMPAIGN_ID = text("""
WITH one AS (
    SELECT
        d.id,
        d.status       AS old_status,
        d.campaign_id  AS campaign_id,
        (c.follow_limit > c.follow_count) AS follow
    FROM campaign c
    JOIN LATERAL (
        SELECT
            d.id, d.status, d.campaign_id,
            d.dst_addr, d.text, d.ext_id,
            d.field_1, d.field_2, d.field_3, d.field_4, d.field_5
        FROM campaign_dst d
        WHERE d.campaign_id = c.id
          AND d.status IN (:created_status, :failed_status)
          AND d.attempts > 0
        ORDER BY d.status, d.id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    ) d ON TRUE
    WHERE c.id = :campaign_id
      {user_clause}
    LIMIT 1
),
upd AS (
    UPDATE campaign_dst d
    SET
        status     = :new_status,
        -- sent_ts только для SENT; для WAITING не трогаем
        sent_ts    = CASE
                        WHEN CAST(:new_status AS INTEGER) = CAST(:sent_status AS INTEGER)
                        THEN :sent_ts
                        ELSE d.sent_ts
                     END,
        -- attempts уменьшаем и для SENT, и для WAITING
        attempts   = d.attempts - 1,
        -- фиксируем момент изменения из Python
        update_ts  = :update_ts
    FROM one
    WHERE d.id = one.id
    RETURNING
        d.*,
        one.old_status,
        one.campaign_id AS picked_campaign_id,
        one.follow
),
upd_campaign AS (
    UPDATE campaign c
    SET
        -- msg_sent инкрементируем ТОЛЬКО для SENT и если старый статус НЕ FAILED
        msg_sent = c.msg_sent + CASE
            WHEN (SELECT old_status FROM upd) = :created_status
            THEN 1 ELSE 0 END,
        -- delivered считаем как раньше
        msg_delivered = CASE
            WHEN CAST(:new_status AS INTEGER) = CAST(:delivered_status AS INTEGER)
            THEN c.msg_delivered + 1
            ELSE c.msg_delivered
        END,
        -- msg_failed: -1 если переходим в WAITING и старый статус был FAILED
        msg_failed = c.msg_failed + CASE
            WHEN (SELECT old_status FROM upd) = :failed_status
            THEN -1 ELSE 0 END,
        -- follow_count "как при SENT" (инкрем, если ниже лимита)
        follow_count = CASE
            WHEN c.follow_limit > c.follow_count THEN c.follow_count + 1
            ELSE c.follow_limit
        END
    WHERE c.id = (SELECT picked_campaign_id FROM upd)
    RETURNING
        c.id,
        c.webhook_url,
        c.msg_template,
        c.msg_status_timeout
)
SELECT
    u.*,
    uc.webhook_url,
    uc.msg_template,
    uc.msg_status_timeout,
    u.follow
FROM upd u
JOIN upd_campaign uc ON uc.id = u.picked_campaign_id;
""")

SQL_GET_NEXT_BY_DEVICE = text("""
WITH one_campaign AS (
    SELECT
        c.id AS campaign_id
    FROM campaign c
    JOIN campaign_androids ca
      ON ca.campaign_id = c.id
     AND ca.device      = :device
    WHERE c.status = :status_running
      AND (
           (c.start_ts IS NOT NULL AND c.stop_ts IS NOT NULL
            AND :now BETWEEN c.start_ts AND c.stop_ts)
           OR
           (c.schedule::jsonb ->> :weekday_str IS NOT NULL
            AND (c.schedule::jsonb -> :weekday_str)::jsonb
                @> TO_JSONB(CAST(:hour AS INTEGER)))
      )
      {user_clause}
      AND EXISTS (
          SELECT 1
          FROM campaign_dst d
          WHERE d.campaign_id = c.id
            AND d.status IN (:created_status, :failed_status)
            AND d.attempts > 0
          LIMIT 1
      )
    ORDER BY c."order", c.msg_sent
    LIMIT 1
),
one AS (
    SELECT
        d.id,
        d.status       AS old_status,
        d.campaign_id  AS campaign_id,
        (c.follow_limit > c.follow_count) AS follow
    FROM one_campaign oc
    JOIN campaign c ON c.id = oc.campaign_id
    JOIN LATERAL (
        SELECT
            d.id, d.status, d.campaign_id,
            d.dst_addr, d.text, d.ext_id,
            d.field_1, d.field_2, d.field_3, d.field_4, d.field_5
        FROM campaign_dst d
        WHERE d.campaign_id = oc.campaign_id
          AND d.status IN (:created_status, :failed_status)
          AND d.attempts > 0
        ORDER BY d.status, d.id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    ) d ON TRUE
),
upd AS (
    UPDATE campaign_dst d
    SET
        status     = :new_status,
        sent_ts    = CASE
                        WHEN CAST(:new_status AS INTEGER) = CAST(:sent_status AS INTEGER)
                        THEN :sent_ts
                        ELSE d.sent_ts
                     END,
        attempts   = d.attempts - 1,
        update_ts  = :update_ts
    FROM one
    WHERE d.id = one.id
    RETURNING
        d.*,
        one.old_status,
        one.campaign_id AS picked_campaign_id,
        one.follow AS follow
),
upd_campaign AS (
    UPDATE campaign c
    SET
        msg_sent = c.msg_sent + CASE
            WHEN (SELECT old_status FROM upd) = :created_status
            THEN 1 ELSE 0 END,
        msg_delivered = CASE
            WHEN CAST(:new_status AS INTEGER) = CAST(:delivered_status AS INTEGER)
            THEN c.msg_delivered + 1
            ELSE c.msg_delivered
        END,
        msg_failed = c.msg_failed + CASE
            WHEN (SELECT old_status FROM upd) = :failed_status
            THEN -1 ELSE 0 END,
        follow_count = CASE
            WHEN c.follow_limit > c.follow_count THEN c.follow_count + 1
            ELSE c.follow_limit
        END
    WHERE c.id = (SELECT picked_campaign_id FROM upd)
    RETURNING
        c.id,
        c.webhook_url,
        c.msg_template,
        c.msg_status_timeout
)
SELECT
    u.*,
    uc.webhook_url,
    uc.msg_template,
    uc.msg_status_timeout,
    u.follow
FROM upd u
JOIN upd_campaign uc ON uc.id = u.picked_campaign_id;
""")

SQL_GET_NEXT_BY_API_KEY = text("""
WITH one_campaign AS (
    SELECT
        c.id AS campaign_id
    FROM campaign c
    JOIN campaign_api_keys cak
      ON cak.campaign_id = c.id
     AND cak.api_key      = :api_key
    WHERE c.status = :status_running
      AND (
           (c.start_ts IS NOT NULL AND c.stop_ts IS NOT NULL
            AND :now BETWEEN c.start_ts AND c.stop_ts)
           OR
           (c.schedule::jsonb ->> :weekday_str IS NOT NULL
            AND (c.schedule::jsonb -> :weekday_str)::jsonb
                @> TO_JSONB(CAST(:hour AS INTEGER)))
      )
      {user_clause}
      AND EXISTS (
          SELECT 1
          FROM campaign_dst d
          WHERE d.campaign_id = c.id
            AND d.status IN (:created_status, :failed_status)
            AND d.attempts > 0
          LIMIT 1
      )
    ORDER BY c."order", c.msg_sent
    LIMIT 1
),
one AS (
    SELECT
        d.id,
        d.status       AS old_status,
        d.campaign_id  AS campaign_id,
        (c.follow_limit > c.follow_count) AS follow
    FROM one_campaign oc
    JOIN campaign c ON c.id = oc.campaign_id
    JOIN LATERAL (
        SELECT
            d.id, d.status, d.campaign_id,
            d.dst_addr, d.text, d.ext_id,
            d.field_1, d.field_2, d.field_3, d.field_4, d.field_5
        FROM campaign_dst d
        WHERE d.campaign_id = oc.campaign_id
          AND d.status IN (:created_status, :failed_status)
          AND d.attempts > 0
        ORDER BY d.status, d.id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    ) d ON TRUE
),
upd AS (
    UPDATE campaign_dst d
    SET
        status     = :new_status,
        sent_ts    = CASE
                        WHEN CAST(:new_status AS INTEGER) = CAST(:sent_status AS INTEGER)
                        THEN :sent_ts
                        ELSE d.sent_ts
                     END,
        attempts   = d.attempts - 1,
        update_ts  = :update_ts
    FROM one
    WHERE d.id = one.id
    RETURNING
        d.*,
        one.old_status,
        one.campaign_id AS picked_campaign_id,
        one.follow AS follow
),
upd_campaign AS (
    UPDATE campaign c
    SET
        msg_sent = c.msg_sent + CASE
            WHEN (SELECT old_status FROM upd) = :created_status
            THEN 1 ELSE 0 END,
        msg_delivered = CASE
            WHEN CAST(:new_status AS INTEGER) = CAST(:delivered_status AS INTEGER)
            THEN c.msg_delivered + 1
            ELSE c.msg_delivered
        END,
        msg_failed = c.msg_failed + CASE
            WHEN (SELECT old_status FROM upd) = :failed_status
            THEN -1 ELSE 0 END,
        follow_count = CASE
            WHEN c.follow_limit > c.follow_count THEN c.follow_count + 1
            ELSE c.follow_limit
        END
    WHERE c.id = (SELECT picked_campaign_id FROM upd)
    RETURNING
        c.id,
        c.webhook_url,
        c.msg_template,
        c.msg_status_timeout
)
SELECT
    u.*,
    uc.webhook_url,
    uc.msg_template,
    uc.msg_status_timeout,
    u.follow
FROM upd u
JOIN upd_campaign uc ON uc.id = u.picked_campaign_id;
""")

SQL_UPDATE_TEXT_AND_EXPIRE = text("""
UPDATE campaign_dst
SET
    text      = COALESCE(:text, text),
    expire_ts = COALESCE(:expire_ts, expire_ts)
WHERE id = :id
""")

SQL_CHECK_BY_CAMPAIGN_ID = text("""
SELECT 1
FROM campaign c
JOIN campaign_dst d ON d.campaign_id = c.id
WHERE c.id = :campaign_id
  {user_clause}
  AND d.status IN (:created_status, :failed_status)
  AND d.attempts > 0
  AND (c.follow_limit > c.follow_count)
LIMIT 1;
""")

SQL_CHECK_BY_DEVICE = text("""
SELECT 1
FROM campaign c
JOIN campaign_androids ca
  ON ca.campaign_id = c.id
 AND ca.device      = :device
WHERE c.status = :status_running
  AND (
       (c.start_ts IS NOT NULL AND c.stop_ts IS NOT NULL
        AND :now BETWEEN c.start_ts AND c.stop_ts)
       OR
       (c.schedule::jsonb ->> :weekday_str IS NOT NULL
        AND (c.schedule::jsonb -> :weekday_str)::jsonb
            @> TO_JSONB(CAST(:hour AS INTEGER)))
  )
  {user_clause}
  AND EXISTS (
      SELECT 1
      FROM campaign_dst d
      WHERE d.campaign_id = c.id
        AND d.status IN (:created_status, :failed_status)
        AND d.attempts > 0
      LIMIT 1
  )
LIMIT 1;
""")

SQL_CHECK_BY_API_KEY = text("""
SELECT 1
FROM campaign c
JOIN campaign_api_keys cak
  ON cak.campaign_id = c.id
 AND cak.api_key      = :api_key
WHERE c.status = :status_running
  AND (
       (c.start_ts IS NOT NULL AND c.stop_ts IS NOT NULL
        AND :now BETWEEN c.start_ts AND c.stop_ts)
       OR
       (c.schedule::jsonb ->> :weekday_str IS NOT NULL
        AND (c.schedule::jsonb -> :weekday_str)::jsonb
            @> TO_JSONB(CAST(:hour AS INTEGER)))
  )
  {user_clause}
  AND EXISTS (
      SELECT 1
      FROM campaign_dst d
      WHERE d.campaign_id = c.id
        AND d.status IN (:created_status, :failed_status)
        AND d.attempts > 0
      LIMIT 1
  )
LIMIT 1;
""")

SQL_GET_BY_DST = text("""
WITH upd AS (
    UPDATE campaign_dst d
    SET
        status     = :sent_status,
        sent_ts    = :sent_ts,
        expire_ts  = CASE
                        WHEN c.msg_status_timeout IS NOT NULL
                        THEN CAST(:sent_ts AS timestamp) + make_interval(secs => c.msg_status_timeout)
                        ELSE NULL
                     END,
        update_ts  = :update_ts
    FROM campaign c
    WHERE d.campaign_id = c.id
      AND d.campaign_id = :campaign_id
      AND d.dst_addr    = :dst_addr
      AND d.status      = :waiting_status
      {USER_CLAUSE}
    RETURNING
        d.id, d.campaign_id, d.dst_addr, d.text,
        d.field_1, d.field_2, d.field_3, d.field_4, d.field_5,
        c.msg_template
),
upd_campaign AS (
    UPDATE campaign c
    SET msg_sent = msg_sent + 1
    WHERE c.id = (SELECT campaign_id FROM upd)
    RETURNING c.id
)
SELECT u.*, uc.id AS campaign_id
FROM upd u
JOIN upd_campaign uc ON uc.id = u.campaign_id;
""")

SQL_SET_STATUS_PROCESSING = text("""
WITH upd AS (
    UPDATE campaign_dst d
    SET
        status    = CASE
                      -- если просят FAILED при attempts<1 → ставим UNDELIVERED
                      WHEN CAST(:new_status AS INTEGER) = :failed_status AND d.attempts < 1
                        THEN :undelivered_status
                      ELSE :new_status
                    END,
        src_addr  = :src_addr,
        sent_ts   = CASE
                      -- SENT: ставим sent_ts из Python
                      WHEN CAST(:new_status AS INTEGER) = :sent_status
                        THEN :sent_ts
                      ELSE d.sent_ts
                    END,
        expire_ts = CASE
                      -- delivered/undelivered/failed → NULL
                      WHEN CAST(:new_status AS INTEGER) IN (:delivered_status, :undelivered_status, :failed_status)
                        THEN NULL
                      -- SENT → :sent_ts + timeout (если есть)
                      WHEN CAST(:new_status AS INTEGER) = :sent_status AND c.msg_status_timeout IS NOT NULL
                        THEN :sent_ts + make_interval(secs => c.msg_status_timeout)
                      ELSE d.expire_ts
                    END,
        -- фиксируем момент изменения из Python
        update_ts = :update_ts
    FROM campaign c
    WHERE d.id = :id
      AND c.id = d.campaign_id
      {USER_CLAUSE}
      AND (
            -- спец-ветка для SENT: разрешено ТОЛЬКО если текущий статус WAITING
            (CAST(:new_status AS INTEGER) = :sent_status
                AND d.status = :waiting_status
            )
            OR
            -- общая ветка (не трогаем терминальные и не дублируем одинаковый статус)
            (CAST(:new_status AS INTEGER) <> :sent_status
                AND d.status NOT IN (:delivered_status, :undelivered_status, :failed_status)
                AND d.status <> CAST(:new_status AS INTEGER)
            )
        )
    RETURNING
        d.id,
        d.campaign_id,
        d.dst_addr,
        d.text,
        d.ext_id,
        d.status      AS new_status,
        c.webhook_url
),
upd_campaign AS (
    UPDATE campaign c
    SET
        msg_delivered   = c.msg_delivered   + CASE WHEN (SELECT 1 FROM upd WHERE new_status = :delivered_status)   IS NOT NULL THEN 1 ELSE 0 END,
        msg_undelivered = c.msg_undelivered + CASE WHEN (SELECT 1 FROM upd WHERE new_status = :undelivered_status) IS NOT NULL THEN 1 ELSE 0 END,
        msg_failed      = c.msg_failed      + CASE WHEN (SELECT 1 FROM upd WHERE new_status = :failed_status)      IS NOT NULL THEN 1 ELSE 0 END,
        status          = CASE
                             WHEN (SELECT 1 FROM upd WHERE new_status IN (:delivered_status, :undelivered_status)) IS NOT NULL
                               AND c.msg_delivered + c.msg_undelivered + 1 >= c.msg_total
                             THEN CAST(:status_complete AS INTEGER)
                             ELSE c.status
                          END
    WHERE c.id = (SELECT campaign_id FROM upd)
    RETURNING c.id
)
SELECT
    u.id,
    u.campaign_id,
    u.dst_addr,
    u.text,
    u.ext_id,
    u.new_status,
    u.webhook_url
FROM upd u
JOIN upd_campaign uc ON uc.id = u.campaign_id
""")


# ================== Python API ==================

async def get_next_processing(
    session: AsyncSession,
    user: models.User,
    *,
    campaign_id: Optional[int] = None,
    api_key: Optional[str] = None,
    device: Optional[str] = None,
    status: schemas.CampaignDstStatus = schemas.CampaignDstStatus.SENT,
    now: datetime,
    weekday: int,
    hour: int,
) -> Any:
    """
    Берём следующее сообщение:
      • выбор 1 dst через LATERAL + FOR UPDATE SKIP LOCKED;
      • UPDATE … RETURNING campaign_dst (status/update_ts; для SENT ещё и sent_ts);
      • обновление агрегатов кампании в CTE:
          - msg_sent ++ только для SENT (и если old_status != FAILED);
          - msg_failed -- если переход FAILED→WAITING;
          - follow_count ++ если ниже лимита.
      • expire_ts — по-прежнему вторым лёгким апдейтом из Python.
    """
    now_ts = datetime.utcnow()
    params_common = {
        "user_id":           user.id,
        "created_status":    int(schemas.CampaignDstStatus.CREATED),
        "failed_status":     int(schemas.CampaignDstStatus.FAILED),
        "waiting_status":    int(schemas.CampaignDstStatus.WAITING),
        "delivered_status":  int(schemas.CampaignDstStatus.DELIVERED),
        "sent_status":       int(schemas.CampaignDstStatus.SENT),
        "new_status":        int(status),
        "update_ts":         now_ts,
        "sent_ts":           now_ts
    }

    if campaign_id is not None:
        sql =  text(
            SQL_GET_NEXT_BY_CAMPAIGN_ID.text.replace(
                "{user_clause}", "AND c.user_id = :user_id"
                if not user.is_superuser else ""
            )
        )
        params = {
            **params_common,
            "campaign_id": campaign_id,
        }
    elif device is not None:
        sql = text(
            SQL_GET_NEXT_BY_DEVICE.text.replace(
                "{user_clause}", "AND c.user_id = :user_id"
                if not user.is_superuser else ""
            )
        )
        params = {
            **params_common,
            "device": device,
            "status_running": int(schemas.CampaignStatus.RUNNING),
            "now": now,
            "weekday_str": str(weekday),
            "hour": int(hour),
        }
    else:
        sql = text(
            SQL_GET_NEXT_BY_API_KEY.text.replace(
                "{user_clause}", "AND c.user_id = :user_id"
                if not user.is_superuser else ""
            )
        )
        params = {
            **params_common,
            "api_key": api_key,
            "status_running": int(schemas.CampaignStatus.RUNNING),
            "now": now,
            "weekday_str": str(weekday),
            "hour": int(hour),
        }

    res = await session.execute(sql, params)
    upd = res.mappings().first()
    if not upd:
        raise HTTPException(
            status_code=404, detail="Active campaigns or messages not found"
        )

    # Финализируем текст (если пустой) — подстановка {field_1..5}
    text_out = safe_replace(upd.get("text"))
    if not text_out and (tpl := upd.get("msg_template")):
        text_out = tpl
        for j in range(1, 6):
            v = upd.get(f"field_{j}")
            if v:
                text_out = text_out.replace("{" + f"field_{j}" + "}", v)

    # Вычислим expire_ts только если есть sent_ts и таймаут — и дотянем вторым апдейтом
    expire_ts = None
    timeout = upd.get("msg_status_timeout")
    if timeout and upd.get("sent_ts"):
        expire_ts = upd["sent_ts"] + timedelta(seconds=timeout)

    if text_out != upd.get("text") or expire_ts is not None:
        await session.execute(
            SQL_UPDATE_TEXT_AND_EXPIRE,
            {
                "id": upd["id"],
                "text": safe_replace(text_out) if text_out != upd.get("text") else None,
                "expire_ts": expire_ts,
            },
        )

    await session.commit()

    # Вебхук шлём только для DELIVERED (оставлено прежним)
    if (
        int(status) == int(schemas.CampaignDstStatus.DELIVERED)
        and upd.get("webhook_url")
        and upd.get("ext_id")
    ):
        webhook.delay(upd["webhook_url"], data={"id": upd["ext_id"], "status": "delivered"})

    return {
        "id":    upd["id"],
        "phone": upd["dst_addr"],
        "text":  safe_replace(text_out or upd.get("text")),
        "follow": upd["follow"],
    }


async def check_processing(
    session: AsyncSession,
    user: models.User,
    *,
    campaign_id: Optional[int] = None,
    api_key: Optional[str] = None,
    device: Optional[str] = None,
    now: datetime,
    weekday: int,
    hour: int,
) -> bool:
    """
    Проверяет наличие доступных сообщений для обработки без их изменения.
    Возвращает True если найдены подходящие сообщения, False иначе.

    Поддерживает три режима проверки:
    - По campaign_id: проверяет конкретную кампанию
    - По device: проверяет кампании, назначенные на устройство
    - По api_key: проверяет кампании, доступные для API-ключа
    """
    params_common = {
        "user_id": user.id,
        "created_status": int(schemas.CampaignDstStatus.CREATED),
        "failed_status": int(schemas.CampaignDstStatus.FAILED),
    }

    if campaign_id is not None:
        sql = text(
            SQL_CHECK_BY_CAMPAIGN_ID.text.replace(
                "{user_clause}", "AND c.user_id = :user_id"
                if not user.is_superuser else ""
            )
        )
        params = {
            **params_common,
            "campaign_id": campaign_id,
        }
    elif device is not None:
        sql = text(
            SQL_CHECK_BY_DEVICE.text.replace(
                "{user_clause}", "AND c.user_id = :user_id"
                if not user.is_superuser else ""
            )
        )
        params = {
            **params_common,
            "device": device,
            "status_running": int(schemas.CampaignStatus.RUNNING),
            "now": now,
            "weekday_str": str(weekday),
            "hour": int(hour),
        }
    else:
        sql = text(
            SQL_CHECK_BY_API_KEY.text.replace(
                "{user_clause}", "AND c.user_id = :user_id"
                if not user.is_superuser else ""
            )
        )
        params = {
            **params_common,
            "api_key": api_key,
            "status_running": int(schemas.CampaignStatus.RUNNING),
            "now": now,
            "weekday_str": str(weekday),
            "hour": int(hour),
        }

    res = await session.execute(sql, params)
    row = res.first()

    return row is not None


async def get_processing(
    session: AsyncSession,
    user: models.User,
    *,
    campaign_id: int,
    dst_addr: str
) -> dict[str, Any]:
    """
    Находит сообщение по (campaign_id, dst_addr) в статусе WAITING и
    атомарно переводит его в SENT, устанавливая sent_ts/expire_ts/update_ts.
    Возвращает {id, phone, text}. Бросает 404, если не найдено/не ваше.
    """
    now_ts = datetime.utcnow()

    sql = text(
        SQL_GET_BY_DST.text.replace(
            "{USER_CLAUSE}",
            "AND c.user_id = :user_id" if not user.is_superuser else ""
        )
    )

    res = await session.execute(
        sql,
        {
            "campaign_id": campaign_id,
            "dst_addr": dst_addr,
            "waiting_status": int(schemas.CampaignDstStatus.WAITING),
            "sent_status": int(schemas.CampaignDstStatus.SENT),
            "sent_ts": now_ts,
            "update_ts": now_ts,
            "user_id": user.id,
        },
    )
    row = res.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Message not found")

    await session.commit()

    # финализируем текст (если в d.text пусто — подставим шаблон и поля)
    text_out = row.get("text")
    if not text_out and (tpl := row.get("msg_template")):
        text_out = tpl
        for i in range(1, 6):
            val = row.get(f"field_{i}")
            if val:
                text_out = text_out.replace("{" + f"field_{i}" + "}", val)

    return {
        "id": row["id"],
        "phone": row["dst_addr"],
        "text": safe_replace(text_out or row.get("text")),
    }


async def set_status_processing(
    session: AsyncSession,
    user: models.User,
    id: int,
    src_addr: Optional[str] = None,
    status: schemas.CampaignDstStatus = schemas.CampaignDstStatus.SENT,
) -> Any:
    """
    Атомарная смена статуса конкретного сообщения:
      • допускаем DELIVERED / UNDELIVERED / FAILED, а также SENT;
      • для SENT: только из WAITING; ставим sent_ts, expire_ts, msg_sent++;
      • update_ts обновляется всегда Python-временем;
      • webhook только при статусах sent/delivered/undelivered.
    """
    DELIVERED   = int(schemas.CampaignDstStatus.DELIVERED)
    UNDELIVERED = int(schemas.CampaignDstStatus.UNDELIVERED)
    FAILED      = int(schemas.CampaignDstStatus.FAILED)
    WAITING     = int(schemas.CampaignDstStatus.WAITING)
    SENT        = int(schemas.CampaignDstStatus.SENT)
    COMPLETE    = int(schemas.CampaignStatus.COMPLETE)

    new_status = getattr(schemas.CampaignDstStatus, status.upper())
    now_ts = datetime.utcnow()

    sql = text(
        SQL_SET_STATUS_PROCESSING.text.replace(
            "{USER_CLAUSE}",
            "AND c.user_id = :user_id" if not user.is_superuser else ""
        )
    )

    res = await session.execute(
        sql,
        {
            "id": id,
            "user_id": user.id,
            "src_addr": src_addr,
            "new_status": new_status,
            "sent_status": SENT,
            "delivered_status": DELIVERED,
            "undelivered_status": UNDELIVERED,
            "failed_status": FAILED,
            "waiting_status": WAITING,
            "status_complete": COMPLETE,
            "update_ts": now_ts,
            "sent_ts": now_ts,
        },
    )
    row = res.mappings().first()

    if not row:
        # либо сообщение не найдено/нет прав, либо тот же статус, либо попытка SENT не из WAITING
        if status and str(status).upper() == "SENT":
            raise HTTPException(status_code=422, detail="Message already sent")
        raise HTTPException(status_code=422, detail="Message status already received")

    await session.commit()

    new_status_int = int(row["new_status"])
    status_str = (
        "delivered"   if new_status_int == DELIVERED   else
        "undelivered" if new_status_int == UNDELIVERED else
        "failed"      if new_status_int == FAILED      else
        "sent"        if new_status_int == SENT        else
        "waiting"
    )

    # Вебхук только для delivered/undelivered
    if row.get("webhook_url") and row.get("ext_id") \
            and new_status_int in (SENT, DELIVERED, UNDELIVERED):
        webhook.delay(
            row["webhook_url"],
            data={"id": row["ext_id"], "status": status_str}
        )

    return {
        "id":        row["id"],
        "dst_addr":  row["dst_addr"],
        "src_addr":  src_addr,
        "text":      safe_replace(row["text"]),
        "status":    status_str,
    }
