import aiohttp
import logging
from typing import Any, Optional

from core.config import settings
from db.session import async_session
from models.link import Link
from schemas.link import LinkShortenItem, LinkShortenRequest, LinkShortenResult


async def create_clicker_task(
    *,
    campaign_id: int,
    url: str,
    x_api_key: str,
    clicks_goal: Optional[int] = None,
    end_time: Optional[str] = None,
    start_time: Optional[str] = None,
    geo: Optional[str] = None,
    click_type: Optional[str] = None,
    split_713: Optional[bool] = None,
    utm_source: Optional[str] = None,
) -> None:
    if not url:
        return

    try:
        async with async_session() as db:
            link = Link(campaign_id=campaign_id, original=url, fake=True)
            db.add(link)
            await db.commit()
            await db.refresh(link)

            payload: dict[str, Any] = {"url": url}
            values = locals()
            for field in [
                "clicks_goal",
                "end_time",
                "start_time",
                "geo",
                "click_type",
                "split_713",
                "utm_source",
            ]:
                value = values[field]
                if value is not None and value != "":
                    payload[field] = value

            headers = {"Content-Type": "application/json"}
            if x_api_key:
                headers["x-api-key"] = x_api_key

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        settings.LINK_CLICKER_URL,
                        headers=headers,
                        json=payload,
                    ) as response:
                        if response.status != 200:
                            logging.error(
                                "Clicker service returned status %s for campaign %s: %s",
                                response.status,
                                campaign_id,
                                await response.text(),
                            )
                            return

                        result = await response.json()
            except Exception as e:
                logging.error(
                    "Error calling clicker service for campaign %s: %s",
                    campaign_id,
                    e,
                )
                return

            new_url = result.get("new_url")
            if not new_url:
                logging.warning(
                    "Clicker service did not return new_url for campaign %s: %s",
                    campaign_id,
                    result,
                )
                return

            link.short = new_url
            db.add(link)
            await db.commit()

            logging.info(
                "Created clicker task for campaign %s: %s -> %s",
                campaign_id,
                url,
                new_url,
            )
    except Exception as e:
        logging.exception(
            "Error creating clicker task for campaign %s: %s",
            campaign_id,
            e,
        )


async def shorten(
    urls: list[LinkShortenItem],
    x_api_key: str,
) -> list[LinkShortenResult]:
    """
    Send one batch to the link shortening service.

    Args:
        urls: URL items to shorten (up to 500)
        x_api_key: User's API key for authentication

    Returns:
        Validated results. Their order is not used for correlation.
    """
    if not urls:
        return []

    request = LinkShortenRequest(x_api_key=x_api_key, urls=urls)
    payload = request.model_dump(exclude_none=True)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                settings.LINK_SHORTENER_URL,
                json=payload,
            ) as response:
                if response.status < 200 or response.status >= 300:
                    response_text = await response.text()
                    raise RuntimeError(
                        "Link shortening service returned "
                        f"status {response.status}: {response_text}"
                    )
                raw_result = await response.json()
    except Exception as e:
        logging.error("Error calling link shortening service: %s", e)
        raise

    if not isinstance(raw_result, list):
        raise ValueError("Link shortening service returned a non-list response")

    results = [LinkShortenResult.model_validate(item) for item in raw_result]
    request_keys = {
        (item.ext_id, item.dst_addr, item.url)
        for item in request.urls
    }
    result_keys = [
        (item.ext_id, item.dst_addr, item.url)
        for item in results
    ]

    if len(request_keys) != len(request.urls):
        raise ValueError("Link shortening request contains duplicate keys")
    if len(result_keys) != len(set(result_keys)):
        raise ValueError("Link shortening service returned duplicate result keys")
    if request_keys != set(result_keys):
        missing = request_keys - set(result_keys)
        unexpected = set(result_keys) - request_keys
        raise ValueError(
            "Link shortening response does not match request: "
            f"missing={missing}, unexpected={unexpected}"
        )

    return results
