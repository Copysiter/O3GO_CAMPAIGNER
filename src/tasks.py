import time
import asyncio

from datetime import datetime, date
from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update

from core.config import settings
from db.session import async_session

import models
import schemas
import crud


celery = Celery(__name__)
celery.conf.broker_url = settings.CELERY_BROKER_URL
celery.conf.result_backend = settings.CELERY_RESULT_BACKEND
celery.conf.broker_connection_retry_on_startup = True


@celery.task(name="create_task")
def create_task(task_type):
    time.sleep(int(task_type) * 10)
    return True


async def get_device(
    db: AsyncSession, ext_id: str = None,
    root: bool = None, operator: str = None, api_key: str = None
) -> models.Device:
    device = await crud.device.get_by_ext_id(db, ext_id=ext_id)
    if not device:
        device = await crud.device.create(db, obj_in={'ext_id': ext_id})

    obj_in = {}
    if root is not None:
        obj_in['root'] = root
    if operator is not None:
        obj_in['operator'] = operator
    if api_key is not None:
        obj_in['api_key'] = api_key

    device = await crud.device.update(db=db, db_obj=device, obj_in=obj_in)

    return device


async def get_service(db: AsyncSession, alias: str = None) -> models.Service:
    service = await crud.service.get_by_alias(db, alias=alias)
    if not service:
        service = await crud.service.create(db, obj_in={'alias': alias})

    return service


async def get_report(
    db: AsyncSession, status: str, api_key: str,
    device_id: int, service_id: int,
) -> models.Report:
    today = date.today()
    report = await crud.report.get_by(
        db=db, api_key=api_key, device_id=device_id,
        service_id=service_id, date=today
    )
    if not report:
        report = await crud.report.create(db, obj_in={
            'api_key': api_key,
            'device_id': device_id,
            'service_id': service_id
        })

    obj_in = {f'{status}_count': getattr(report, f'{status}_count') + 1}
    if status == 'code':
        obj_in.update({'ts_1': datetime.utcnow()})

    report = await crud.report.update(db=db, db_obj=report, obj_in=obj_in)

    return report


async def get_proxy(
    db: AsyncSession, url: str,
    status: str, api_key: str = None
) -> models.Proxy:
    proxy = await crud.proxy.get_by_url(db, url=url)
    if not proxy:
        proxy = await crud.proxy.create(db, obj_in={'url': url})
    api_keys = list(proxy.api_keys)
    if api_key and api_key not in api_keys:
        api_keys.append(api_key)
    obj_in = {
        f'{status}_count': getattr(proxy, f'{status}_count') + 1,
        'api_keys': api_keys
    }
    if status == 'good':
        obj_in.update({'ts_1': datetime.utcnow()})
    proxy.api_keys = []

    proxy = await crud.proxy.update(db=db, db_obj=proxy, obj_in=obj_in)

    return proxy


async def get_number(
    db, number: str, api_key: str, proxy: str,
    device_ext_id: str, service_alias: str,
    info_1: str, info_2: str, info_3: str
) -> models.Number:
    number_ = await crud.number.get_by_number(db, number=number)

    if not number_:
        number_ = await crud.number.create(db=db, obj_in={
            'number': number,
            'service_alias': service_alias,
            'api_key': api_key,
            'proxy': proxy,
            'device_ext_id': device_ext_id,
            'info_1': info_1,
            'info_2': info_2,
            'info_3': info_3
        })

    return number_


async def update_report_info(
    db, device_id: int, api_key: str,
    info_1: str = None, info_2: str = None, info_3: str = None
) -> None:
    values = {}
    if info_1:
        values['info_1'] = info_1
    if info_1:
        values['info_2'] = info_2
    if info_1:
        values['info_3'] = info_3
    statement = (
        update(models.Report).
        where(models.Report.device_id == device_id and
              models.Report.api_key == api_key).
        values(**values)
    )
    await db.execute(statement)
    await db.commit()


async def event_handler(data: schemas.WebhookRequest):
    async with async_session() as db:
        api_key = data.get('api_key')
        device_ext_id = data.get('device_id')
        device_root = data.get('root')
        device_operator = data.get('operator')
        service_alias = data.get('service')
        number = data.get('number')
        info_1 = data.get('info_1')
        info_2 = data.get('info_2')
        info_3 = data.get('info_3')
        report_status = data.get('status')
        check_status = report_status in (
            'start', 'number', 'bad', 'code', 'no_code')
        proxy_url = data.get('proxy')
        proxy_status = data.get('proxy_status')
        check_proxy_status = data.get('proxy_status') in ('good', 'bad')

        device, service = None, None

        if device_ext_id:
            device = await get_device(
                db, ext_id=device_ext_id, root=device_root,
                operator=device_operator, api_key=api_key
            )

        if check_status or number:
            service = await get_service(db, alias=service_alias)

        if check_status and device and service:
            _ = await get_report(
                db, api_key=api_key, device_id=device.id,
                service_id=service.id, status=report_status
            )

        if proxy_url and check_proxy_status:
            _ = await get_proxy(
                db, url=proxy_url, status=proxy_status, api_key=api_key)

        if number and device and service:
            _ = await get_number(
                db, number=number, api_key=api_key, proxy=proxy_url,
                device_ext_id=device.ext_id, service_alias=service.alias,
                info_1=info_1, info_2=info_2, info_3=info_3
            )
        
        if not number and device:
            await update_report_info(
                db, device_id=device.id, api_key=api_key,
                info_1=info_1, info_2=info_2, info_3=info_3)


@celery.task(name="webhook")
def webhook_handler(data: schemas.WebhookRequest):
    loop = asyncio.get_event_loop()
    loop.run_until_complete(event_handler(data))
