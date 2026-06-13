import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['cargo_app']
    
    invoices = db.invoices.find()
    count = 0
    async for inv in invoices:
        for pkg_item in inv.get('packages', []):
            pkg_id = pkg_item.get('package_id')
            if not pkg_id:
                continue
            
            unit_price = pkg_item.get('manual_unit_price')
            if unit_price is None:
                unit_price = pkg_item.get('calculated_unit_price', 0)
            
            qte = pkg_item.get('weight_or_volume', 0)
            line_total = float(unit_price * qte)
            
            update_data = {
                "$set": {
                    "invoice_status": "draft",
                    "invoice_id": str(inv['_id']),
                    "total_price": line_total
                }
            }
            
            print(f"Updating package {pkg_id} with {update_data}")
            await db.packages.update_one({"_id": str(pkg_id)}, update_data)
            count += 1
    print(f'Updated {count} packages from existing invoices')

if __name__ == "__main__":
    asyncio.run(main())
