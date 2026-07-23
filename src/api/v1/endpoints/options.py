from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session

import crud, models, schemas  # noqa

from api import deps  # noqa
from core.config import settings
from core.permissions import OPENROUTER_MODEL_PERMISSION
from services.ai.openrouter import (
    OpenRouterModelsError,
    OpenRouterModelsTimeoutError,
    fetch_openrouter_models,
)
from services.android import AndroidService


router = APIRouter()


@router.get('/user', response_model=List[schemas.OptionInt])
async def get_user_options(
    *,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Retrieve user options.
    """
    filters = [
        {'field': 'user_id', 'operator': 'eq', 'value': user.id}
    ] if not user.is_superuser else []
    rows = await crud.user.get_rows(db, filters=filters, limit=None)
    return JSONResponse([{
        'text': rows[i].name if rows[i].name else rows[i].login,
        'value': rows[i].id
    } for i in range(len(rows))])


@router.get('/api_key', response_model=List[schemas.OptionInt])
async def get_api_keys_options(
    *,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve api_key options.
    """
    # user_id = user.id if not user.is_superuser else None
    # rows = await crud.user.get_api_keys(db, user_id=user_id)
    filters = [
        {'field': 'user_id', 'operator': 'eq', 'value': user.id}
    ] if not user.is_superuser else []
    rows = await crud.api_key.get_rows(db, filters=filters, limit=None)
    return JSONResponse([{
        'text': rows[i].value,
        'value': rows[i].value
    } for i in range(len(rows)) if rows[i].value])


@router.get('/android', response_model=List[schemas.OptionInt])
async def get_android_options(
    *,
    user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve android_device options.
    """
    android = AndroidService()
    data = await android.get_device_options(x_api_key=user.ext_api_key)
    return JSONResponse(data)


@router.get('/openrouter/models', response_model=List[schemas.OptionStr])
async def get_openrouter_model_options(
    *,
    user: models.User = Depends(deps.get_current_active_user),
) -> Any:
    """Retrieve OpenRouter models available to the configured account."""
    can_select_model = user.is_superuser or (
        OPENROUTER_MODEL_PERMISSION in user.permissions
    )
    if not can_select_model:
        return []

    api_key = settings.AI_OPENROUTER_API_KEY.strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='OpenRouter is not configured',
        )

    try:
        models_data = await fetch_openrouter_models(api_key)
    except OpenRouterModelsTimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail='OpenRouter model catalog timed out',
        ) from exc
    except OpenRouterModelsError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail='Unable to load OpenRouter models',
        ) from exc

    options = {}
    for model_data in models_data:
        if not isinstance(model_data, dict):
            continue
        model_id = model_data.get('id')
        if not isinstance(model_id, str) or not model_id.strip():
            continue
        model_id = model_id.strip()
        model_name = model_data.get('name')
        text = model_name.strip() if isinstance(model_name, str) else ''
        options.setdefault(model_id, {
            'text': text or model_id,
            'value': model_id,
        })

    return sorted(
        options.values(),
        key=lambda option: (
            option['text'].casefold(),
            option['value'].casefold(),
        ),
    )


@router.get('/tag', response_model=List[schemas.OptionInt])
async def get_tag_options(
    *,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Retrieve tag options.
    """
    filters = [
        {'field': 'user_id', 'operator': 'eq', 'value': user.id}
    ] if not user.is_superuser else []
    rows = await crud.tag.get_rows(db, filters=filters, limit=None)
    return JSONResponse([{
        'text': rows[i].name,
        'value': rows[i].id,
        'color_txt': rows[i].color_txt,
        'color_bg': rows[i].color_bg
    } for i in range(len(rows))])


@router.get('/permission', response_model=List[schemas.OptionStr])
async def get_permission_options(
    *,
    db: Session = Depends(deps.get_db),
    _: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Retrieve permission options.
    """
    rows = await crud.permission.get_rows(
        db,
        filters=[{'field': 'is_active', 'operator': 'eq', 'value': True}],
        orders=[{'field': 'name', 'dir': 'asc'}],
        limit=None,
    )
    return JSONResponse([{
        'text': row.name,
        'value': row.key,
    } for row in rows])
