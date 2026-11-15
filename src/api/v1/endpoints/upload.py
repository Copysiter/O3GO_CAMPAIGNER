from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from api import deps
import models
from schemas.campaign_import import ImportPreviewRequest
from services import campaign_import


router = APIRouter()


def _http_error(exc):
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


@router.post('/')
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    current_user: models.User = Depends(deps.get_current_active_user),
):
    form = await request.form()
    uploaded = [value for _, value in form.multi_items() if hasattr(value, 'filename')]
    if len(uploaded) != 1:
        raise HTTPException(status_code=422, detail='За один раз можно загрузить только один файл')
    content = bytearray()
    maximum = campaign_import.upload_limit()
    try:
        while chunk := await file.read(min(1024 * 1024, maximum + 1 - len(content))):
            content.extend(chunk)
            if len(content) > maximum:
                raise HTTPException(status_code=413, detail='Превышен допустимый размер файла')
        return await run_in_threadpool(
            campaign_import.create_import, file.filename or '', bytes(content), current_user.id
        )
    except campaign_import.CampaignImportError as exc:
        raise _http_error(exc) from exc
    finally:
        await file.close()


@router.post('/{import_id}/preview')
async def preview_import(
    import_id: UUID,
    body: ImportPreviewRequest,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    try:
        result = await run_in_threadpool(
            campaign_import.prepare_import, import_id, current_user.id,
            body.mappings, body.default_region,
        )
        return {key: value for key, value in result.items() if key != 'rows'}
    except campaign_import.CampaignImportError as exc:
        raise _http_error(exc) from exc


@router.delete('/{import_id}', status_code=204)
async def remove_import(
    import_id: UUID,
    current_user: models.User = Depends(deps.get_current_active_user),
):
    try:
        await run_in_threadpool(campaign_import.remove_import, import_id, current_user.id)
    except campaign_import.CampaignImportError as exc:
        raise _http_error(exc) from exc
