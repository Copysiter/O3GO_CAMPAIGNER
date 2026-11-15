"""Original-link snapshots and the import-wide GEO workbook."""
from collections import defaultdict
from io import BytesIO
import re

from openpyxl import Workbook
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Font
from sqlalchemy import select

from models.campaign import Campaign
from models.campaign_dst import CampaignDst


# Deliberately matches links_geo.py: one preferred [short] URL, or first HTTP URL.
SHORT_URL = re.compile(r"\[short\](https?://[^\[\s]+)\[/short\]")
HTTP_URL = re.compile(r"https?://[^\s<>\"'\]\[]+")


def extract_report_link(message: str | None) -> str | None:
    if not message:
        return None
    match = SHORT_URL.search(message)
    if match:
        return match.group(1)
    match = HTTP_URL.search(message)
    return match.group(0) if match else None


def build_geo_workbook(rows) -> bytes:
    """Count distinct canonical phones per (geo, link), and across the import."""
    groups = defaultdict(set)
    all_phones = set()
    for row in rows:
        geo, link, phone = row
        groups[(geo or "UNKNOWN", link or "")].add(phone)
        all_phones.add(phone)

    book = Workbook()
    sheet = book.active
    sheet.title = "Ссылки по GEO"
    sheet.append(["Гео", "Ссылка", "Количество"])
    for (geo, link), phones in sorted(
        groups.items(), key=lambda item: (-len(item[1]), item[0])
    ):
        sheet.append([geo, ILLEGAL_CHARACTERS_RE.sub("", link) or "Без ссылки", len(phones)])
    sheet.append(["ИТОГО", "Уникальных телефонов во всей загрузке", len(all_phones)])
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:C{max(1, sheet.max_row - 1)}"
    for row_index in (1, sheet.max_row):
        for cell in sheet[row_index]:
            cell.font = Font(bold=True)
    for column, width in {"A": 16, "B": 80, "C": 16}.items():
        sheet.column_dimensions[column].width = width
    output = BytesIO()
    book.save(output)
    book.close()
    return output.getvalue()


async def get_import_report_rows(db, import_id, user):
    """Only accessible campaigns participate; don't expose other users' imports."""
    allowed = select(Campaign.id).where(Campaign.import_id == import_id)
    if not user.is_superuser:
        allowed = allowed.where(Campaign.user_id == user.id)
    campaign_ids = list((await db.execute(allowed)).scalars().all())
    if not campaign_ids:
        return None
    result = await db.execute(
        select(CampaignDst.geo, CampaignDst.link, CampaignDst.dst_addr)
        .where(CampaignDst.campaign_id.in_(campaign_ids))
    )
    return result.all()
