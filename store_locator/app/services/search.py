import redis
import math
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app import models
from app.config import settings
from geopy.geocoders import Nominatim
from datetime import datetime

# --- 1. REDIS SETUP ---
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=0,
        decode_responses=True
    )
except Exception as e:
    print(f"Redis connection skipped: {e}")
    redis_client = None


# --- 2. GEOCODER HELPER ---
def get_lat_lon(query: str) -> Tuple[Optional[float], Optional[float]]:
    geolocator = Nominatim(user_agent="retail_locator_v12")
    try:
        location = geolocator.geocode(f"{query}, USA", timeout=10)
        if location:
            return location.latitude, location.longitude
    except Exception:
        pass
    return None, None


# --- 3. OPEN NOW LOGIC ---
def is_store_open(store, current_time_str: str):
    # current_time_str format: "HH:MM"
    days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    # datetime.now().weekday() is 0 for Monday.
    # Our list is 0 for Sunday, so we adjust with (weekday + 1) % 7
    day_idx = (datetime.now().weekday() + 1) % 7
    day_name = days[day_idx]

    hours = getattr(store, f"hours_{day_name}", None)
    if not hours or hours.lower() == "closed":
        return False

    try:
        # Expects format "09:00-21:00"
        start_str, end_str = hours.split("-")
        start = start_str.strip()
        end = end_str.strip()

        # Handle stores closing after midnight (e.g., 18:00-02:00)
        if end < start:
            return current_time_str >= start or current_time_str <= end

        return start <= current_time_str <= end
    except:
        return False


# --- 4. SEARCH LOGIC ---
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
    # 1. THE EMERGENCY FIX: Remove the .filter(status.ilike("active"))
    # This ensures that even if your data has no status, it SHOWS UP.
    query = db.query(models.Store)

    # 2. Relaxed Type Filter
    if store_type and store_type.strip() and store_type.lower() != "all":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    all_candidates = query.all()

    # Debug print for Railway logs
    print(f"DEBUG: Found {len(all_candidates)} total stores in DB.")

    valid_stores = []
    current_time = datetime.now().strftime("%H:%M")

    # 3. Logic for Nationwide vs Proximity
    if lat is None or lon is None or radius_miles >= 5000:
        for s in all_candidates:
            if open_now and not is_store_open(s, current_time):
                continue
            s.distance_miles = None
            valid_stores.append(s)
    else:
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                if open_now and not is_store_open(store, current_time):
                    continue
                store.distance_miles = dist
                valid_stores.append(store)

        valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

    # 4. Pagination & Final Response
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
                "hours_mon": s.hours_mon,
                "is_open": is_store_open(s, current_time)
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