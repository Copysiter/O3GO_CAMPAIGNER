import os

import pandas as pd
import openpyxl

from openpyxl.worksheet.table import Table, TableStyleInfo
from typing import Any, List, Dict, Union
from datetime import datetime, timedelta
from io import BytesIO

from fastapi import APIRouter, Body, Depends, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.encoders import jsonable_encoder

from api import deps

import crud, models, schemas

router = APIRouter()


@router.get('/', response_model=schemas.CampaignRows)
async def read_campaigns(
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100
) -> Any:
    '''
    Retrieve campaigns.
    '''
    if not orders:
        orders = [{'field': 'id', 'dir': 'desc'}]
    filters_modified = []
    tags_idx = None
    status_idx = None

    for filter in filters:
        if sub_filters := filter.get('filters'):
            for filter in sub_filters:
                filters_modified.append(filter)
        else:
            filters_modified.append(filter)

    filters = []
    for i in range(len(filters_modified)):
        if filters_modified[i]['field'] == 'tags':
            if tags_idx is None:
                tags_idx = len(filters)
                filters.append({
                    'relationship': models.Campaign.campaign_tags,
                    'field': models.CampaignTags.tag_id,
                    'operator': 'overlaps',
                    'value': [filters_modified[i]['value']]
                })
            else:
                filters[tags_idx]['value'].append(filters_modified[i]['value'])
        if filters_modified[i]['field'] == 'status':
            if status_idx is None:
                status_idx = len(filters)
                filters.append({
                    'field': 'status',
                    'operator': 'overlaps',
                    'value': [filters_modified[i]['value']]
                })
            else:
                filters[status_idx]['value'].append(filters_modified[i]['value'])
    if current_user.is_superuser:
        campaigns = await crud.campaign.get_rows(
            db, skip=skip, limit=limit, filters=filters, orders=orders)
        count = await crud.campaign.get_count(db, filters=filters)
    else:
        campaigns = await crud.campaign.get_rows_by_user(
            db, user_id=current_user.id, filters=filters,
            orders=orders, skip=skip, limit=limit
        )
        count = await crud.campaign.get_count_by_user(
            db, user_id=current_user.id, filters=filters
        )
    return {'data' : campaigns, 'total': count}


@router.post('/', response_model=schemas.Campaign)
async def create_campaign(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    campaign_in: schemas.CampaignCreate
) -> Any:
    '''
    Create new campaign.
    '''

    ts = datetime.utcnow()

    campaign_db_in = schemas.CampaignUpdate(
        name = campaign_in.name,
        user_id = campaign_in.user_id if campaign_in.user_id else current_user.id,
        webhook_url=campaign_in.webhook_url,
        api_keys = campaign_in.api_keys,
        tags = campaign_in.tags,
        schedule = campaign_in.schedule,
        msg_attempts=campaign_in.msg_attempts,
        msg_sending_timeout=campaign_in.msg_sending_timeout,
        msg_status_timeout=campaign_in.msg_status_timeout,
        msg_template = campaign_in.msg_template,
        msg_total = 0,
        order=campaign_in.order,
        create_ts = ts,
        start_ts=campaign_in.start_ts,
        stop_ts=campaign_in.stop_ts,
        status = campaign_in.status
    )

    # campaign_db_in = schemas.CampaignUpdate(
    #     **campaign_in.model_dump()
    # )
    # if not campaign_db_in.user_id:
    #     campaign_db_in.user_id = current_user.id

    campaign_dst_in = []
    fields = campaign_in.data_fields

    if (campaign_in.data_text and
        campaign_in.data_text_row_sep and
        campaign_in.data_text_col_sep
    ):
        for line in campaign_in.data_text.split(campaign_in.data_text_row_sep):
            campaign_dst = {}
            campaign_dst['attempts'] = campaign_in.msg_attempts
            if campaign_in.msg_sending_timeout:
                campaign_dst['expire_ts'] = ts + timedelta(
                    seconds=campaign_in.msg_sending_timeout
                )
            row = line.split(campaign_in.data_text_col_sep)
            for f in fields:
                if (f in ['dst_addr', 'field_1', 'field_2', 'field_3']
                        and fields[f] is not None and int(fields[f]) < len(row)):
                    campaign_dst[f] = row[int(fields[f])]
            campaign_dst_in.append(campaign_dst)

    if campaign_in.data_file_name:
        ext = os.path.splitext(campaign_in.data_file_name)[1]
        data = pd.DataFrame()
        if ext in ['.csv', '.txt']:
            try:
                data = pd.read_csv(f'upload/{campaign_in.data_file_name}', sep='[\s+|,;:]', header=None)
            except pd.errors.ParserError:
                data = pd.read_csv(f'upload/{campaign_in.data_file_name}', header=None)
            data = data.astype(str)
        if ext in ['.xls', '.xlsx']:
            data = pd.read_excel(f'upload/{campaign_in.data_file_name}', sheet_name=0, header=None)
            data = data.astype(str)
        for i, row in data.iterrows():
            campaign_dst = {}
            campaign_dst['attempts'] = campaign_in.msg_attempts
            if campaign_in.msg_sending_timeout:
                campaign_dst['expire_ts'] = ts + timedelta(
                    seconds=campaign_in.msg_sending_timeout
                )
            for i in fields:
                if (i in ['dst_addr', 'field_1', 'field_2', 'field_3']
                        and fields[i] is not None and int(fields[i]) in row):
                    campaign_dst[i] = row[int(fields[i])].strip().strip('"').strip('\'')
            campaign_dst_in.append(campaign_dst)

    campaign_db_in.msg_total = len(campaign_dst_in)
    campaign = await crud.campaign.create(db=db, obj_in=campaign_db_in)

    if (campaign.id and len(campaign_dst_in) > 0):
        for i in range(len(campaign_dst_in)):
            campaign_dst_in[i]['campaign_id'] = campaign.id
        _ = await crud.campaign_dst.create_rows(db=db, obj_in=campaign_dst_in)

    return campaign


@router.post('/start', response_model=List[schemas.Campaign])
async def update_campaign_rows(
    *,
    current_user: models.User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    ids: List[int] = Body(..., embed=True)
) -> Any:
    '''
    Start a campaigns.
    '''
    user_id = None if current_user.is_superuser else current_user.id
    result = await crud.campaign.update_rows(db, ids=ids, user_id=user_id, obj_in={
        'status': schemas.CampaignStatus.RUNNING
    })
    return result


@router.post('/stop', response_model=List[schemas.Campaign])
async def update_campaign_rows(
    *,
    current_user: models.User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    ids: List[int] = Body(..., embed=True)
) -> Any:
    '''
    Start a campaigns.
    '''
    user_id = None if current_user.is_superuser else current_user.id
    result = await crud.campaign.update_rows(db, ids=ids, user_id=user_id, obj_in={
        'status': schemas.CampaignStatus.STOPPED
    })
    return result


@router.delete('/', response_model=List[int])
async def delete_campaign_rows(
    *,
    current_user: models.User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    ids: List[int] = Body(..., embed=True)
) -> Any:
    '''
    Start a campaigns.
    '''
    user_id = None if current_user.is_superuser else current_user.id
    result = await crud.campaign.delete_rows(db, ids=ids, user_id=user_id)
    return result


@router.put('/{id}', response_model=schemas.Campaign)
async def update_campaign(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    id: int,
    campaign_in: schemas.CampaignUpdate
) -> Any:
    '''
    Update a campaign.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    campaign = await crud.campaign.update(
        db=db, db_obj=campaign, obj_in=campaign_in)
    if campaign.create_ts:
        campaign.create_ts = campaign.create_ts.strftime('%Y-%m-%d %H:%M:%S')
    if campaign.start_ts:
        campaign.start_ts = campaign.start_ts.strftime('%Y-%m-%d %H:%M:%S')
    if campaign.stop_ts:
        campaign.stop_ts = campaign.stop_ts.strftime('%Y-%m-%d %H:%M:%S')
    return campaign


@router.post('/{id}/start', response_model=schemas.Campaign)
async def update_campaign(
    *,
    current_user: models.User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    id: int
) -> Any:
    '''
    Start a campaign.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    start_ts = campaign.start_ts if campaign.start_ts else datetime.utcnow()
    campaign = await crud.campaign.update(
        db=db, db_obj=campaign, obj_in={
            'status': schemas.CampaignStatus.RUNNING,
            'start_ts': start_ts
        })
    return campaign

@router.post('/{id}/pause', response_model=schemas.Campaign)
async def update_campaign(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    id: int
) -> Any:
    '''
    Pause an campaign.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    stop_ts = campaign.stop_ts if campaign.stop_ts else datetime.utcnow()
    campaign = await crud.campaign.update(
        db=db, db_obj=campaign, obj_in={
            'status': schemas.CampaignStatus.PAUSED
        })
    return campaign

@router.post('/{id}/stop', response_model=schemas.Campaign)
async def update_campaign(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    id: int
) -> Any:
    '''
    Stop an campaign.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    stop_ts = campaign.stop_ts if campaign.stop_ts else datetime.utcnow()
    campaign = await crud.campaign.update(
        db=db, db_obj=campaign, obj_in={
            'status': schemas.CampaignStatus.STOPPED,
            'stop_ts': stop_ts
        })
    return campaign


@router.get('/{id}', response_model=schemas.Campaign)
async def read_campaign(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    id: int
) -> Any:
    '''
    Get campaign by ID.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    return campaign


@router.delete('/{id}', response_model=schemas.Campaign)
async def delete_campaign(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    id: int
) -> Any:
    '''
    Delete an campaign.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    campaign = await crud.campaign.delete(db=db, id=id)
    return campaign


@router.get('/{id}/campaign_dst', response_model=schemas.CampaignDstRows)
async def read_campaign_campaign_dsts(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_active_user),
    id: int,
    filters: List[schemas.Filter] = Depends(deps.request_filters),
    orders: List[schemas.Order] = Depends(deps.request_orders),
    skip: int = 0,
    limit: int = 100,
    request: Request = None
) -> Any:
    '''
    Get campaign campaign_dsts.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    if not orders:
        orders = [{'field': 'id', 'dir': 'asc'}]
    filters.append({'field': 'campaign_id', 'operator': 'eq', 'value': id})
    campaign_dsts = jsonable_encoder(
        await crud.campaign_dst.get_rows(
            db=db, skip=skip, limit=limit, filters=filters, orders=orders
        )
    )
    for i in range(len(campaign_dsts)):
        if not campaign_dsts[i]['text']:
            campaign_dsts[i]['text'] = campaign.msg_template or ''
            for j in range(1, 6):
                field = f'field_{j}'
                if (campaign_dsts[i][field]):
                    campaign_dsts[i]['text'] = campaign_dsts[i]['text'].replace(
                        '{' + field + '}', campaign_dsts[i][field]
                    )
    count = await crud.campaign_dst.get_count(db=db, filters=filters)
    return JSONResponse({'data' : campaign_dsts, 'total': count})


@router.delete('/{id}/campaign_dst', response_model=schemas.Campaign)
async def read_campaign_campaign_dsts(
        *,
        db: AsyncSession = Depends(deps.get_db),
        current_user: models.User = Depends(deps.get_current_active_user),
        id: int,
) -> Any:
    '''
    Get campaign campaign_dsts.
    '''
    campaign = await crud.campaign.get(db=db, id=id)
    if not campaign:
        raise HTTPException(status_code=404, detail='Campaign not found')
    if campaign.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(
            status_code=400, detail='The user doesn\'t have enough privileges'
        )
    user_id = None if current_user.is_superuser else current_user.id
    await crud.campaign_dst.delete_rows(db, campaign_id=id, user_id=user_id)
    campaign = await crud.campaign.update(
        db=db, db_obj=campaign, obj_in={
            'msg_total': 0, 'msg_sent': 0, 'msg_delivered': 0,
            'msg_undelivered': 0, 'msg_failed': 0
        }
    )
    return campaign


@router.get('/{campaign_id}/report')
async def download_campaign_report(
    *,
    db: AsyncSession = Depends(deps.get_db),
    campaign_id: int
):
    campaign = await crud.campaign.get(db=db, id=campaign_id)
    if not campaign:
        raise HTTPException(
            status_code=404, detail='Campaign not found')

    filters = [{
        'field': 'campaign_id', 'operator': 'eq', 'value': campaign_id
    }]
    orders = [{'field': 'id', 'dir': 'asc'}]
    campaign_dsts = await crud.campaign_dst.get_rows(
        db=db, limit=campaign.msg_total, filters=filters, orders=orders
    )
    if not campaign_dsts:
        raise HTTPException(
            status_code=404, detail="No campaign messages found")

    output = BytesIO()
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = f"Campaign_{campaign_id}_report"

    headers = [
        "Название рассылки", "Номер телефона",
        "Время отправки", "Статус", "Сообщение"
    ]
    sheet.append(headers)

    for dst in campaign_dsts:
        text = campaign.msg_template
        for j in range(1, 6):
            field = f'field_{j}'
            if getattr(dst, field):
                text = text.replace(
                    '{' + field + '}', getattr(dst, field)
                )
        sheet.append([
            campaign.name,
            dst.dst_addr,
            dst.sent_ts.strftime('%Y-%m-%d %H:%M:%S') if dst.sent_ts else '',
            schemas.CampaignDstStatus.name(dst.status),
            dst.text or text
        ])

    table_ref = 'A1:{}'.format(
        sheet.cell(row=sheet.max_row, column=sheet.max_column).coordinate
    )
    table = Table(displayName='DataTable', ref=table_ref)
    style = TableStyleInfo(
        name='TableStyleMedium9',
        showFirstColumn=False, showLastColumn=False,
        showRowStripes=True, showColumnStripes=False
    )
    table.tableStyleInfo = style
    sheet.add_table(table)

    for column in sheet.columns:
        adjusted_width = max(len(str(cell.value)) for cell in column)
        sheet.column_dimensions[
            column[0].column_letter].width = adjusted_width + 5

    workbook.save(output)
    output.seek(0)

    filename = '{}_report_{}.xlsx'.format(
        campaign_id, datetime.utcnow().strftime("%Y%m%d%H%M%S")
    )
    headers = {
        'Content-Disposition': f'attachment; filename={filename}'
    }

    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-'
                   'officedocument.spreadsheetml.sheet',
        headers=headers
    )
