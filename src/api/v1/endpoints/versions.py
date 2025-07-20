import uuid, shutil  # noqa

from pathlib import Path
from typing import Any, List  # noqa

from fastapi import (
    APIRouter, Depends, Request, UploadFile, File, HTTPException, status  # noqa
)
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from api import deps  # noqa

import crud, models, schemas  # noqa


UPLOAD_DIR = Path('upload/apk')
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


router = APIRouter()


@router.get('/', response_model=schemas.VersionRows)
async def read_versions(
    db: AsyncSession = Depends(deps.get_db),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Retrieve versions.
    """
    versions = await crud.version.get_rows(
        db, filters=filters, orders=orders, skip=skip, limit=limit
    )
    count = await crud.version.get_count(db, filters=filters)
    return {'data': versions, 'total': count}


@router.post(
    '/',
    response_model=schemas.Version,
    status_code=status.HTTP_201_CREATED
)
async def create_version(
    *,
    db: AsyncSession = Depends(deps.get_db),
    version_in: schemas.VersionCreate,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Create new version.
    """
    version = await crud.version.create(
        db=db, obj_in=version_in
    )
    return version


@router.put('/{id}', response_model=schemas.Version)
async def update_version(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    version_in: schemas.VersionUpdate,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Update an version.
    """
    version = await crud.version.get(db=db, id=id)
    if not version:
        raise HTTPException(status_code=404, detail='Version not found')
    version = await crud.version.update(
        db=db, db_obj=version, obj_in=version_in
    )
    return version


@router.get('/{id}', response_model=schemas.Version)
async def read_version(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Get version by ID.
    """
    version = await crud.version.get(db=db, id=id)
    if not version:
        raise HTTPException(status_code=404, detail='Version not found')
    return version


@router.delete('/{id}', response_model=schemas.Version)
async def delete_version(
    *,
    db: AsyncSession = Depends(deps.get_db),
    id: int,
    _: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    """
    Delete an version.
    """
    version = await crud.version.get(db=db, id=id)
    if not version:
        raise HTTPException(status_code=404, detail='Version not found')

    version = await crud.version.delete(db=db, id=id)

    if version.file_name:
        file_path = UPLOAD_DIR / version.file_name
        if file_path.exists() and file_path.is_file():
            file_path.unlink()

    return version


@router.post('/upload')
async def upload_apk(file: UploadFile = File(...)):
    if not file.filename.endswith('.apk'):
        raise HTTPException(
            status_code=400, detail='The file must have a .apk extension'
        )
    file_path = UPLOAD_DIR / file.filename

    with file_path.open('wb') as buffer:
        shutil.copyfileobj(file.file, buffer)

    return JSONResponse(content={'file_name': str(file.filename)})


@router.post('/remove')
async def remove_apk(request: Request):
    form = await request.form()
    filename = form.get('file_name')
    if not filename or not filename.endswith(".apk"):
        raise HTTPException(status_code=400, detail="Invalid file name")

    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_path.unlink()

    return JSONResponse(content={"message": "File deleted successfully"})
