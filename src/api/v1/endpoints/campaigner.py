import asyncio
import time

from datetime import datetime

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

from campaigner import campaigner

router = APIRouter()

@router.get('/')
async def sender_info():
    return JSONResponse({'status': campaigner.state_id, 'last_activity': campaigner.last_activity})

@router.post('/start')
async def start_campaigner():
    if campaigner.state_id == 0:
        campaigner.sender.loop.create_task(campaigner.start())
    return JSONResponse({'status': campaigner.state_id, 'last_activity': campaigner.last_activity})

@router.post('/stop')
async def stop_campaigner():
    await campaigner.stop()
    return JSONResponse({'status': campaigner.state_id, 'last_activity': campaigner.last_activity})