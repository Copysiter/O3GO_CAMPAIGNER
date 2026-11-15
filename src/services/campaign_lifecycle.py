"""Deadlines for campaigns held after an import until their first start."""
from datetime import datetime, timedelta, timezone
from sqlalchemy import update
from models.campaign_dst import CampaignDst
from schemas.status import CampaignDstStatus, CampaignStatus


async def initialize_import_deadlines(db, campaign, changes=None):
    if not getattr(campaign, "import_id", None) or campaign.status == CampaignStatus.RUNNING:
        return
    changes = changes or {}
    timeout = changes.get("msg_sending_timeout", campaign.msg_sending_timeout)
    if not timeout:
        return
    scheduled = changes.get("start_ts", campaign.start_ts) or datetime.min
    if scheduled.tzinfo:
        scheduled = scheduled.astimezone(timezone.utc).replace(tzinfo=None)
    started = max(datetime.utcnow(), scheduled)
    await db.execute(
        update(CampaignDst).where(
            CampaignDst.campaign_id == campaign.id,
            CampaignDst.expire_ts.is_(None),
            CampaignDst.status.in_([CampaignDstStatus.CREATED, CampaignDstStatus.WAITING]),
        ).values(expire_ts=started + timedelta(seconds=timeout))
    )
