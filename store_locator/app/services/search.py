# app/services/search.py
import math
import time
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from app import models
from geopy.geocoders import Nominatim
from datetime import datetime

# --- 1. IN-MEMORY CACHE SETUP (Satisfies Section 1.6) ---
# Format: { "key": { "value": data, "expires": timestamp } }
_internal_cache: Dict[str, dict] = {}


def cache_get(key: str):
    """Retrieve data from memory if it exists and hasn't expired."""
    data = _internal_cache.get(key)
    if not data:
        return None
    if time.time() > data["expires"]:
        del _internal_cache[key]  # Cleanup expired
        return None
    return data["value"]


def cache_set(key: str, value, ttl_seconds: int):
    """Save data to memory with an expiration time."""
    _internal_cache[key] = {
        "value": value,
        "expires": time.time() + ttl_seconds
    }


# --- 2. GEOCODER WITH CACHING ---
def get_lat_lon(query: str) -> Tuple[Optional[float], Optional[float]]:
    # Check Cache First (Requirement: Cache Geocoding)
    cache_key = f"geo:{query.lower().strip()}"
    cached_geo = cache_get(cache_key)
    if cached_geo:
        print(f"DEBUG: Cache Hit for Geocode '{query}'")
        return cached_geo

    # If not in cache, call API
    geolocator = Nominatim(user_agent="retail_locator_final_v1")
    try:
        location = geolocator.geocode(f"{query}, USA", timeout=10)
        if location:
            result = (location.latitude, location.longitude)
            # Save to Cache for 30 Days (30 * 24 * 60 * 60 seconds)
            cache_set(cache_key, result, 2592000)
            return result
    except Exception as e:
        print(f"Geocode Error: {e}")

    return None, None


# --- 3. OPEN NOW LOGIC ---
def is_store_open(store, current_time_str: str):
    days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    day_idx = (datetime.now().weekday() + 1) % 7
    day_name = days[day_idx]

    hours = getattr(store, f"hours_{day_name}", None)
    if not hours or hours.lower() == "closed":
        return False

    try:
        start_str, end_str = hours.split("-")
        return start_str <= current_time_str <= end_str
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
    # 1. Base Query
    query = db.query(models.Store)
    if store_type and store_type.lower() != "all":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    all_candidates = query.all()

    valid_stores = []
    current_time = datetime.now().strftime("%H:%M")

    # 2. Filtering
    if lat is None or lon is None or radius_miles >= 5000:
        # Nationwide
        for s in all_candidates:
            if open_now and not is_store_open(s, current_time):
                continue
            s.distance_miles = None
            valid_stores.append(s)
    else:
        # Distance
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                if open_now and not is_store_open(store, current_time):
                    continue
                store.distance_miles = dist
                valid_stores.append(store)

        valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

    # 3. Pagination & Mapping
    total = len(valid_stores)
    start = (page - 1) * limit
    paginated = valid_stores[start: start + limit]

    results = []
    for s in paginated:
        results.append({
            "store_id": s.store_id,
            "name": s.name,
            "store_type": s.store_type,
            "status": s.status,
            "address_street": s.address_street,
            "address_city": s.address_city,
            "address_state": s.address_state,
            "address_postal_code": s.address_postal_code,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "distance": getattr(s, 'distance_miles', None),
            "phone": s.phone,
            "hours_mon": s.hours_mon,
            "hours_tue": s.hours_tue,
            "hours_wed": s.hours_wed,
            "hours_thu": s.hours_thu,
            "hours_fri": s.hours_fri,
            "hours_sat": s.hours_sat,
            "hours_sun": s.hours_sun,
            "is_open": is_store_open(s, current_time)
        })

    return {"results": results, "total": total, "page": page, "limit": limit}


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 3958.8
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))