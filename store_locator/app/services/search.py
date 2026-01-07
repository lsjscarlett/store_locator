from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
import redis
import math
from app import models
from app.config import settings
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
from datetime import datetime
import pytz


# --- REDIS SETUP ---
try:
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=0,
        decode_responses=True
    )
    redis_client.ping()  # Check connection
except Exception as e:
    print(f"Redis not available: {e}")
    redis_client = None


# --- GEOCODER HELPER ---
def get_lat_lon(query: str) -> Tuple[Optional[float], Optional[float]]:
    geolocator = Nominatim(user_agent="my_locator_final_v4")
    try:
        # Strategy 1: Direct Search (Strict)
        location = geolocator.geocode({"postalcode": query, "country": "USA"}, timeout=10)

        # Strategy 2: Relaxed Search (Fallback for 10036 types)
        if not location:
            location = geolocator.geocode(f"{query}, USA", timeout=10)

        if location:
            return location.latitude, location.longitude
    except Exception:
        pass
    return None, None

# --- SEARCH LOGIC (Fixed Signature) ---
def search_stores_logic(
        db: Session,
        lat: Optional[float],
        lon: Optional[float],
        radius_miles: float,
        store_type: Optional[str],
        services: Optional[List[str]],
        page: int,
        limit: int,
        open_now=False
):
    # 1. Start with a broad query (Case-Insensitive)
    # Using ilike ensures 'Active' matches 'active'
    query = db.query(models.Store).filter(models.Store.status.ilike("active"))

    # 2. Filter by Store Type (if selected)
    if store_type and store_type.strip() and store_type.lower() != "all":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    all_candidates = query.all()

    # --- SAFETY CHECK ---
    # If the 'active' filter broke it, try fetching EVERYTHING just to be sure
    if not all_candidates:
        all_candidates = db.query(models.Store).all()

    current_time = datetime.now().strftime("%H:%M")
    valid_stores = []

    # 3. Distance & Nationwide Logic
    # If Nationwide (5000) or geocoding failed, skip the math and return all
    is_nationwide = radius_miles >= 5000

    if lat is None or lon is None or is_nationwide:
        valid_stores = all_candidates
        for s in valid_stores:
            s.distance_miles = None
    else:
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            # Use the actual radius_miles passed from payload
            if dist <= radius_miles:
                if open_now and not is_store_open(store, current_time):
                    continue
                store.distance_miles = dist
                valid_stores.append(store)

        # Only sort if we have distances
        valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

    # 4. Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    paginated_results = valid_stores[start:start + limit]

    # 5. Clean Mapping
    final_results = []
    for s in paginated_results:
        final_results.append({
            "store_id": s.store_id,
            "name": s.name,
            "address_street": s.address_street,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "distance": getattr(s, 'distance_miles', None),
            "store_type": s.store_type,
            "hours_mon": s.hours_mon
        })

    return {
        "results": final_results,
        "page": page,
        "limit": limit,
        "total": total
    }

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 3958.8  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2)**2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_store_open(store, current_time_str: str):
    # current_time_str format: "HH:MM"
    days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    # weekday() returns 0 for Monday, but our index needs 0 for Sunday to match the list above
    day_idx = (datetime.now().weekday() + 1) % 7
    day_name = days[day_idx]

    hours = getattr(store, f"hours_{day_name}", "closed")
    if not hours or hours.lower() == "closed":
        return False
    try:
        start_str, end_str = hours.split("-")
        return start_str.strip() <= current_time_str <= end_str.strip()
    except:
        return False

