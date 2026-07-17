from typing import Any, List
import hashlib
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps
import crud
import schemas


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/shorten/mock",
    response_model=List[schemas.LinkShortenResult],
    response_model_exclude_none=True,
)
async def shorten_mock(
    *,
    request: schemas.LinkShortenRequest,
) -> Any:
    """
    Mock endpoint for link shortening - generates fake short URLs for local testing.
    Does NOT call external services. Does NOT save to database.

    Use this for testing by setting in .env:
    LINK_SHORTENER_URL=http://localhost:5001/ext/api/v1/links/shorten/mock

    The hash includes campaign and recipient identifiers to emulate unique links.
    """
    results = []
    for item in request.urls:
        hash_source = f"{item.ext_id}:{item.dst_addr or ''}:{item.url}"
        url_hash = hashlib.md5(hash_source.encode()).hexdigest()[:6]
        short_url = f"http://camp.o3go.ru/{url_hash}"

        results.append(
            {
                "url": item.url,
                "dst_addr": item.dst_addr,
                "ext_id": item.ext_id,
                "new_url": short_url,
            }
        )

    return results


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
            {
                "short": "http://camp.o3go.ru/a1b2c3",
                "ext_id": 501,
                "dst_addr": "79001112233",
                "count": 5
            },
            {
                "short": "http://camp.o3go.ru/xyz123",
                "ext_id": 501,
                "count": 3
            }
        ]
    }

    Example response:
    {
        "counts": {"1": 8},
        "success": 2,
        "errors": 0
    }
    """
    if not request.links:
        return {"counts": {}, "success": 0, "errors": 0}

    # Инкрементируем счетчики кликов в таблице Link
    result = await crud.link.click(db=db, items=request.links)

    # Инкрементируем счетчики link_clicks в таблице Campaign
    if result["link_counts"]:
        await crud.campaign.link_click(db=db, counts=result["link_counts"])
    if result["fakes"]:
        await crud.campaign.fake_click(db=db, counts=result["fakes"])

    logger.info(
        f"Link clicks registered: success={result['success']}, "
        f"errors={result['errors']}, campaigns={list(result['link_counts'].keys())}, "
        f"fake_campaigns={list(result['fakes'].keys())}"
    )

    return {
        "counts": result["counts"],
        "success": result["success"],
        "errors": result["errors"],
    }
