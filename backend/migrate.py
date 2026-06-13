import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def migrate():
    db = AsyncIOMotorClient('mongodb://localhost:27017')['cargo_app']
    async for p in db.packages.find({'timeline': {'$exists': True}}):
        new_timeline = []
        changed = False
        for t in p['timeline']:
            if 'step' in t:
                new_t = {
                    'status': t['step'],
                    'label': t.get('label', t['step']),
                    'timestamp': t.get('completed_at'),
                    'location': t.get('location')
                }
                new_timeline.append({k: v for k, v in new_t.items() if v is not None})
                changed = True
            else:
                new_timeline.append(t)
        if changed:
            await db.packages.update_one({'_id': p['_id']}, {'$set': {'timeline': new_timeline}})
    print('Done')

asyncio.run(migrate())
