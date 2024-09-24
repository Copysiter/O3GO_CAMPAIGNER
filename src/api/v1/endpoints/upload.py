# import aiofiles

import os
import pandas as pd

from time import time
from uuid import uuid4

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import JSONResponse

from api import deps
import models


router = APIRouter()


@router.post('/')
async def upload_file(file: UploadFile = File(...)):
    current_user: models.User = Depends(deps.get_current_active_user),
    timestamp = int(time())
    ext = os.path.splitext(file.filename)[1]
    filename = f'{uuid4()}{ext}'
    with open(f'upload/{filename}', 'wb') as out_file:
        content = await file.read()
        out_file.write(content)
        out_file.close()
    '''
    async with aiofiles.open(file_name, "wb") as buffer:
        data = await file.read()
        await buffer.write(data)
    ''' 
    fields = []
    if ext in ['.csv', '.txt']:
        data = pd.read_csv(f'upload/{filename}', sep='[,;:]', header=None)
        data = data.astype(str)
        # fields = data.loc[len(data) // 2, :].tolist()
        fields = [i.strip().strip('"').strip('\'') for i in data.loc[len(data) // 2, :].tolist()]
    if ext in ['.xls', '.xlsx']:
        data = pd.read_excel(f'upload/{filename}', sheet_name=0, header=None)
        data = data.astype(str)
        # fields = data.loc[len(data) // 2, :].tolist()
        fields = [i.strip().strip('"').strip('\'') for i in data.loc[len(data) // 2, :].tolist()]
    return JSONResponse({'filename': filename, 'fields': fields})