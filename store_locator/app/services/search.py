# app/services/search.py

from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
import redis
import math
from app import models
from app.config import settings
from geopy.geocoders import Nominatim
from datetime import datetime

# --- REDIS SETUP ---
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=0,
        decode_responses=True
    )
except Exception:
    redis_client = None


# --- GEOCODER HELPER ---
def get_lat_lon(query: str) -> Tuple[Optional[float], Optional[float]]:
    geolocator = Nominatim(user_agent="my_locator_final_v7")
    try:
        location = geolocator.geocode(f"{query}, USA", timeout=10)
        if location:
            return location.latitude, location.longitude
    except Exception:
        pass
    return None, None


# --- SEARCH LOGIC ---
def search_stores_logic(
        db: Session,
        lat: Optional[float],
        lon: Optional[float],
        radius_miles: float,
        store_type: Optional[str],
        services: Optional[List[str]],
        page: int,
        limit: int,
        open_now: bool = False
):
    # 1. TEMPORARY: Fetch EVERYTHING to prove DB connection is alive
    # We ignore "active" and "store_type" filters for this test
    all_candidates = db.query(models.Store).all()

    # Log to Railway console so you can see if data is being pulled
    print(f"FORCE LOG: Found {len(all_candidates)} stores in database.")

    valid_stores = []
    current_time = datetime.now().strftime("%H:%M")

    # 2. Nationwide / Proximity Logic
    # If radius is Nationwide (5000) or geocoding failed, skip distance checks
    if lat is None or lon is None or radius_miles >= 5000:
        valid_stores = all_candidates
        for s in valid_stores:
            s.distance_miles = None
    else:
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                # We skip "Open Now" for this test to ensure results show
                store.distance_miles = dist
                valid_stores.append(store)

        valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

    # 3. Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    paginated = valid_stores[start: start + limit]

    return {
        "results": [
            {
                "store_id": s.store_id,
                "name": s.name,
                "address_street": s.address_street,
                "latitude": s.latitude,
                "longitude": s.longitude,
                "distance": getattr(s, 'distance_miles', None),
                "store_type": s.store_type,
                "hours_mon": s.hours_mon
            } for s in paginated
        ],
        "total": total,
        "page": page,
        "limit": limit
    }


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 3958.8
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def is_store_open(store, current_time):
    days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    day_name = days[(datetime.now().weekday() + 1) % 7]
    hours = getattr(store, f"hours_{day_name}", "closed")
    if not hours or hours.lower() == "closed": return False
    try:
        start, end = hours.split("-")
        return start.strip() <= current_time <= end.strip()
    except:
        return False