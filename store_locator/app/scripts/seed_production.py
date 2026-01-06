import random
from app.database import SessionLocal, engine
from app.models import Store, Base
from sqlalchemy import text


def seed_data():
    db = SessionLocal()
    try:
        print("Cleaning old data...")
        db.execute(text('TRUNCATE TABLE stores CASCADE;'))

        print("Generating 1,000 stores...")
        stores = []
        for i in range(1000):
            # Generating random-ish coordinates across the US
            lat = random.uniform(25.0, 48.0)
            lon = random.uniform(-125.0, -70.0)

            s = Store(
                store_id=f"STORE-{i:04d}",
                name=f"Store Location {i}",
                store_type=random.choice(['retail', 'flagship', 'cafe']),
                status='active',
                latitude=lat,
                longitude=lon,
                address_street=f"{random.randint(100, 999)} Main St",
                address_city="CityName",
                address_state="ST",
                address_postal_code=str(random.randint(10000, 99999)),
                address_country="USA"
            )
            stores.append(s)

        db.add_all(stores)
        db.commit()
        print(f"✅ Successfully seeded {len(stores)} stores!")
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()