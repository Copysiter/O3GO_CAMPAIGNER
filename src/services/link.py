import aiohttp
import logging
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from db.session import async_session
from models.link import Link
import crud


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
    urls: list[str],
    x_api_key: str,
    db: Optional[AsyncSession] = None,
    campaign_id: Optional[int] = None,
) -> dict:
    """
    Send URLs to link shortening service and get shortened URLs.
    Optionally saves results to database if db and campaign_id are provided.

    Args:
        urls: List of URLs to shorten
        x_api_key: User's API key for authentication
        db: Database session (optional, for saving results)
        campaign_id: Campaign ID (optional, for saving results)

    Returns:
        Dict with results: {"results": [{"original": str, "short": str}, ...]}
        Returns empty results list on error.
    """
    if not urls:
        return {"results": []}

    url = settings.LINK_SHORTENER_URL
    params = {"x_api_key": x_api_key} if x_api_key else {}
    payload = {"urls": urls}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, params=params, json=payload) as response:
                if response.status == 200:
                    result = await response.json()

                    # Сохраняем результаты в БД, если переданы db и campaign_id
                    if db is not None and campaign_id is not None:
                        if result.get("results"):
                            try:
                                await crud.link.insert(
                                    db, campaign_id=campaign_id, results=result["results"]
                                )
                                logging.info(
                                    f"Saved {len(result['results'])} shortened URLs "
                                    f"for campaign {campaign_id}"
                                )
                            except Exception as e:
                                logging.error(
                                    f"Error saving shortened URLs to database: {e}"
                                )
                                # Не прерываем выполнение, возвращаем результаты

                    return result
                else:
                    logging.error(
                        f"Link shortening service returned status {response.status}: "
                        f"{await response.text()}"
                    )
                    return {"results": []}
    except Exception as e:
        logging.error(f"Error calling link shortening service: {e}")
        return {"results": []}
