from typing import Any, List
import hashlib
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps
from services.link import shorten
import crud, models, schemas


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/shorten/mock")
async def shorten_mock(
    *,
    request: schemas.LinkShortenRequest,
) -> Any:
    """
    Mock endpoint for link shortening - generates fake short URLs for local testing.
    Does NOT call external services. Does NOT save to database.

    Use this for testing by setting in .env:
    LINK_SHORTENER_URL=http://localhost:5001/ext/api/v1/links/shorten/mock

    Example request:
    {
        "urls": ["https://example.com/long-url-1", "https://example.com/long-url-2"]
    }

    Example response:
    {
        "results": [
            {"original": "https://example.com/long-url-1", "short": "http://camp.o3go.ru/a1b2c3"},
            {"original": "https://example.com/long-url-2", "short": "http://camp.o3go.ru/d4e5f6"}
        ]
    }
    """
    if not request.urls:
        return {"results": []}

    results = []
    for url in request.urls:
        # Generate short hash from URL (first 6 characters of MD5)
        url_hash = hashlib.md5(url.encode()).hexdigest()[:6]
        short_url = f"http://camp.o3go.ru/{url_hash}"

        results.append({"original": url, "short": short_url})

    return {"results": results}


@router.post("/click", response_model=schemas.LinkClickResponse)
async def link_click_webhook(
    *,
    db: AsyncSession = Depends(deps.get_db),
    _=Depends(deps.get_user_by_api_key),
    request: schemas.LinkClickWebhook,
) -> Any:
    """
    Webhook endpoint для регистрации кликов по сокращённым ссылкам.

    Внешний сервис сокращения ссылок отправляет POST-запрос на этот endpoint
    при переходах по коротким ссылкам.

    Требуется аутентификация через X-Api-Key заголовок или x_api_key query параметр.

    Example request:
    POST /ext/api/v1/links/click?x_api_key=your-api-key
    или
    POST /ext/api/v1/links/click
    X-Api-Key: your-api-key

    {
        "links": [
            {"short": "http://camp.o3go.ru/a1b2c3", "count": 5},
            {"short": "http://camp.o3go.ru/xyz123", "count": 3}
        ]
    }

    Example response:
    {
        "success": 2,
        "errors": 0
    }
    """
    if not request.links:
        return {"success": 0, "errors": 0}

    # Инкрементируем счетчики кликов в таблице Link
    result = await crud.link.click(db=db, items=request.links)

    # Инкрементируем счетчики link_clicks в таблице Campaign
    if result["counts"]:
        await crud.campaign.link_click(db=db, counts=result["counts"])

    logger.info(
        f"Link clicks registered: success={result['success']}, "
        f"errors={result['errors']}, campaigns={list(result['counts'].keys())}"
    )

    return {
        "success": result["success"],
        "errors": result["errors"],
    }
