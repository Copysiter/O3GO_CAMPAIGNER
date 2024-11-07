from typing import Any
from fastapi import APIRouter, Body  # noqa

router = APIRouter()


@router.post('/')
async def webhook(data: dict = Body(...)) -> Any:
    return data
