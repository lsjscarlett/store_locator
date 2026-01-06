import csv
import os
import sys
from sqlalchemy import text # NEW: Import text
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Store

def seed_from_csv(file_path: str):
    # If file isn't in root, check the scripts folder
    if not os.path.exists(file_path):
        script_file = os.path.join(os.path.dirname(__file__), file_path)
        if os.path.exists(script_file):
            file_path = script_file
        else:
            print(f"❌ Error: {file_path} not found.")
            return

    db: Session = SessionLocal()

    try:
        print("Emptying stores table to remove old data...")
        # FIXED: Wrapped the SQL string in text()
        db.execute(text("TRUNCATE TABLE stores RESTART IDENTITY CASCADE;"))
        db.commit()

        with open(file_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            print(f"✅ CSV Headers found: {reader.fieldnames}")

            stores_to_add = []
            for row in reader:
                store = Store(
                    store_id=row.get('store_id'),
                    name=row.get('name') or row.get('Store Name'),
                    store_type=row.get('store_type', 'retail'),
                    address_street=row.get('address_street'),
                    address_city=row.get('address_city'),
                    address_state=row.get('address_state'),
                    address_postal_code=row.get('address_postal_code'),
                    latitude=float(row['latitude']) if row.get('latitude') else 0.0,
                    longitude=float(row['longitude']) if row.get('longitude') else 0.0,
                    status="active",
                    hours_mon=row.get('hours_mon'),
                    hours_tue=row.get('hours_tue'),
                    hours_wed=row.get('hours_wed'),
                    hours_thu=row.get('hours_thu'),
                    hours_fri=row.get('hours_fri'),
                    hours_sat=row.get('hours_sat'),
                    hours_sun=row.get('hours_sun'),
                    phone=row.get('phone', '')
                )
                stores_to_add.append(store)

            db.bulk_save_objects(stores_to_add)
            db.commit()
            print(f"🚀 SUCCESS: Seeded {len(stores_to_add)} stores!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error during seed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Ensure this file is either in the root or in app/scripts/
    seed_from_csv("stores_1000.csv")