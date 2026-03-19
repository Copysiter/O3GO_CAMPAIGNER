import aiohttp
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
import crud


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
