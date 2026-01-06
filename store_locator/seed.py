from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models
from app.auth_utils import get_password_hash
from app.database import SQLALCHEMY_DATABASE_URL
from app.utils import process_services
import os
import csv

def main():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    # 1. Create Tables
    print("Creating tables...")
    models.Base.metadata.create_all(bind=engine)

    # 2. Seed Roles
    print("Seeding Roles...")
    roles = ["admin", "marketer", "viewer"]
    role_objs = {}
    for r_name in roles:
        role = db.query(models.Role).filter_by(name=r_name).first()
        if not role:
            role = models.Role(name=r_name)
            db.add(role)
            db.commit()
            db.refresh(role)
        role_objs[r_name] = role

    # 3. Seed Users
    print("Seeding Admin User...")
    users_to_create = [
        {"email": "admin@test.com", "role": "admin"},
        {"email": "marketer@test.com", "role": "marketer"},
        {"email": "viewer@test.com", "role": "viewer"}
    ]
    default_pw_hash = get_password_hash("TestPassword123!")

    for u in users_to_create:
        user = db.query(models.User).filter_by(email=u["email"]).first()
        if not user:
            user = models.User(
                email=u["email"],
                password_hash=default_pw_hash,
                role=role_objs[u["role"]],
                is_active=True
            )
            db.add(user)
    db.commit()

    # 4. Seed Stores with Services
    print("Seeding Stores...")

    csv_file = "stores_50.csv"

    if os.path.exists(csv_file):
        print(f"Reading {csv_file}...")
        # encoding='utf-8-sig' handles the BOM if Excel saved it
        with open(csv_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                store_id = row["store_id"]

                # Avoid duplicates
                if db.query(models.Store).filter_by(store_id=store_id).first():
                    continue

                new_store = models.Store(
                    store_id=store_id,
                    name=row["name"],
                    store_type=row["store_type"],
                    status=row["status"],
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    address_street=row["address_street"],
                    address_city=row["address_city"],
                    address_state=row["address_state"],
                    address_postal_code=row["address_postal_code"],
                    address_country=row["address_country"],
                    phone=row["phone"],

                    # Use helper to convert "wifi|coffee" -> [ServiceObj, ServiceObj]
                    services=process_services(db, row["services"]),

                    hours_mon=row["hours_mon"],
                    hours_tue=row["hours_tue"],
                    hours_wed=row["hours_wed"],
                    hours_thu=row["hours_thu"],
                    hours_fri=row["hours_fri"],
                    hours_sat=row["hours_sat"],
                    hours_sun=row["hours_sun"]
                )
                db.add(new_store)
                count += 1
            db.commit()
            print(f"✅ Successfully seeded {count} stores from CSV.")
    else:
        print(f"⚠️ {csv_file} not found in root folder. Skipping initial store seed.")

    db.close()


if __name__ == "__main__":
    main()
