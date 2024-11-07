import asyncio

from datetime import datetime, timedelta
from celery import Celery
from sqlalchemy import text

from db.session import async_session

import schemas


app = Celery('myapp')





@app.task
def update_messages():
    asyncio.run(update_expired_messages)
    asyncio.run(update_sent_messages)