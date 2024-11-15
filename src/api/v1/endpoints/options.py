from typing import Any, List

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session

import crud, models, schemas  # noqa
from api import deps  # noqa


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
    } for i in range(len(rows))])


@router.get('/tag', response_model=List[schemas.OptionInt])
async def get_tag_options(
    *,
    db: Session = Depends(deps.get_db),
    user: models.User = Depends(deps.get_current_active_superuser)
) -> Any:
    """
    Retrieve tag options.
    """
    filters = [
        {'field': 'user_id', 'operator': 'eq', 'value': user.id}
    ] if not user.is_superuser else []
    rows = await crud.tag.get_rows(db, limit=None)
    return JSONResponse([{
        'text': rows[i].name,
        'value': rows[i].id,
        'color_txt': rows[i].color_txt,
        'color_bg': rows[i].color_bg
    } for i in range(len(rows))])