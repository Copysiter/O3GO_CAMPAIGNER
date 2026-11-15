"""Offline phone normalization shared by campaign import and GEO previews."""
import re
from typing import Optional

import phonenumbers


_PHONE_CHARACTERS = re.compile(r"^[+\d\s().-]+$")


def normalize_phone(raw: str, default_region: Optional[str] = None) -> dict:
    """Return a digits-only E.164 address and an ISO country, if geographical.

    Without a selected default region, numbers without '+' are international.
    Validation checks numbering rules, not whether the subscriber exists.
    """
    value = str(raw or "").strip()
    if not value:
        raise ValueError("Не указан номер телефона")
    if not _PHONE_CHARACTERS.fullmatch(value):
        raise ValueError("В номере телефона есть недопустимые символы")
    region = default_region.strip().upper() if default_region else None
    if region and region not in phonenumbers.SUPPORTED_REGIONS:
        raise ValueError("Неизвестный код страны для национальных номеров")
    if not value.startswith("+") and not region:
        value = "+" + value
    try:
        number = phonenumbers.parse(value, region)
    except phonenumbers.NumberParseException as exc:
        raise ValueError("Не удалось разобрать номер: укажите международный формат") from exc
    if not phonenumbers.is_valid_number(number):
        raise ValueError("Номер не соответствует правилам телефонной нумерации")
    country = phonenumbers.region_code_for_number(number)
    if country == "001":
        country = None
    return {
        "dst_addr": phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164).lstrip("+"),
        "geo": country,
    }
