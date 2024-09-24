import asyncio

from datetime import datetime

from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.session import async_session

from models import Campaign, CampaignDst


class Campaigner:
    def __init__(self):
        self.state_id = 0
        self.server = None
        self.last_activity = None
        #self.db = SessionLocal()
        self.campaigns = {}
        self.messages = {}

    async def update_dst(self, message_id, data):
        try:
            dst = self.messages[str(message_id)]
            async with async_session() as db:
                result = await db.execute(
                    select(CampaignDst).where(CampaignDst.msg_id == str(message_id))
                )
                dst = result.scalar()
                print()
                print('DST:')
                print(dst)
                print('DATA:')
                print(data)
                print()
                if dst:
                    result = await db.execute(
                        select(Campaign).where(Campaign.id == dst.campaign_id)
                    )
                    campaign = result.scalar()
            
                    for field, value in data.items():
                        if field == 'parts':
                            dst.msg_parts = value
                            campaign.msg_parts += value
                        else:
                            if field == 'submit_status' and value == 2:
                                dst.msg_sent += 1
                                campaign.msg_sent += 1
                            elif field == 'submit_status': # and not dst.submit_status:
                                #dst.msg_sent += 1
                                dst.msg_submitted += value
                                dst.msg_failed += int(value == 0)
                                campaign.msg_submitted += value
                                campaign.msg_failed += int(value == 0)
                            if field == 'delivery_status' and not dst.submit_status:
                                dst.msg_delivered += value
                                campaign.msg_delivered += value
                            setattr(dst, field, value)
                            
                    await db.merge(dst)
                    await db.merge(campaign)
                    await db.commit()
        except Exception as e: print('campaigner.update_dst:', e)

    async def worker(self):
        async with async_session() as db:
            while self.state_id == 1:
                cur_day = datetime.utcnow().isoweekday()
                cur_hour = datetime.utcnow().hour
                for campaign in self.campaigns.values():
                    if (campaign.status_id != 1 and
                        cur_hour not in campaign.schedule[str(cur_day)]):
                        continue
                    result = await db.execute(
                        select(CampaignDst).where(
                            (CampaignDst.campaign_id == campaign.id) &
                            (CampaignDst.msg_id == None)
                        )
                    )
                    dst = result.scalar()
                    if dst:
                        text = campaign.msg_template
                        for j in range(1, 6):
                            field = f'field_{j}'
                            if (getattr(dst, field, field)):
                                text = text.replace('{' + field + '}', getattr(dst, field, field))
                        #print(text)
                    else:
                        campaign.status_id = 3
                        await db.merge(campaign)
                        await db.commit()
                
                self.last_activity = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
                await asyncio.sleep(1)

    async def run(self):
        self.state_id = 1;
        async with async_session() as db:
            result = await db.execute(
                select(Campaign).where(
                    Campaign.status_id == 1
                )
            )
            for campaign in result.scalars():
                self.campaigns[campaign.id] = campaign
            await asyncio.gather(asyncio.create_task(self.worker()))

    async def stop(self):
        self.state_id = 0
        self.last_activity = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        self.campaigns = {}

    async def start(self):
        self.state_id = 1
        self.last_activity = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        await asyncio.gather(asyncio.create_task(self.run()))   

campaigner = Campaigner()

#async def campaigner_init():
#    await asyncio.gather(asyncio.create_task(campaigner.start()))


#if __name__ ==  '__main__':
#   campaigner = Campaigner()
#    asyncio.run(campaigner.start())
