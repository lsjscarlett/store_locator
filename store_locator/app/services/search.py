import math
import time
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from app import models
from geopy.geocoders import Nominatim
from datetime import datetime
import pytz  # Required for Timezone fix

# --- 1. IN-MEMORY CACHE ---
_internal_cache: Dict[str, dict] = {}


def cache_get(key: str):
    data = _internal_cache.get(key)
    if not data:
        return None
    if time.time() > data["expires"]:
        del _internal_cache[key]
        return None
    return data["value"]


def cache_set(key: str, value, ttl_seconds: int):
    _internal_cache[key] = {
        "value": value,
        "expires": time.time() + ttl_seconds
    }


# --- 2. GEOCODER ---
def get_lat_lon(query: str) -> Tuple[Optional[float], Optional[float]]:
    cache_key = f"geo:{query.lower().strip()}"
    cached_geo = cache_get(cache_key)
    if cached_geo:
        return cached_geo

    geolocator = Nominatim(user_agent="retail_locator_final_v3")
    try:
        location = geolocator.geocode(f"{query}, USA", timeout=10)
        if location:
            result = (location.latitude, location.longitude)
            cache_set(cache_key, result, 2592000)
            return result
    except Exception:
        pass

    return None, None


# --- 3. TIMEZONE MAP & OPEN LOGIC ---
STATE_TIMEZONES = {
    'MA': 'America/New_York', 'RI': 'America/New_York', 'CT': 'America/New_York',
    'NY': 'America/New_York', 'NJ': 'America/New_York', 'PA': 'America/New_York',
    'DE': 'America/New_York', 'MD': 'America/New_York', 'VA': 'America/New_York',
    'NC': 'America/New_York', 'SC': 'America/New_York', 'GA': 'America/New_York',
    'FL': 'America/New_York', 'ME': 'America/New_York', 'NH': 'America/New_York',
    'VT': 'America/New_York', 'OH': 'America/New_York', 'MI': 'America/New_York',
    'IN': 'America/New_York', 'KY': 'America/New_York', 'WV': 'America/New_York',

    'IL': 'America/Chicago', 'WI': 'America/Chicago', 'MN': 'America/Chicago',
    'IA': 'America/Chicago', 'MO': 'America/Chicago', 'ND': 'America/Chicago',
    'SD': 'America/Chicago', 'NE': 'America/Chicago', 'KS': 'America/Chicago',
    'OK': 'America/Chicago', 'TX': 'America/Chicago', 'AL': 'America/Chicago',
    'MS': 'America/Chicago', 'TN': 'America/Chicago', 'AR': 'America/Chicago',
    'LA': 'America/Chicago',

    'MT': 'America/Denver', 'ID': 'America/Denver', 'WY': 'America/Denver',
    'UT': 'America/Denver', 'CO': 'America/Denver', 'NM': 'America/Denver',
    'AZ': 'America/Phoenix',

    'CA': 'America/Los_Angeles', 'NV': 'America/Los_Angeles', 'OR': 'America/Los_Angeles',
    'WA': 'America/Los_Angeles',

    'AK': 'America/Anchorage', 'HI': 'Pacific/Honolulu'
}


def is_store_open(store, current_time_unused=None):
    # 1. Determine Store's Timezone
    tz_name = STATE_TIMEZONES.get(store.address_state, 'UTC')
    tz = pytz.timezone(tz_name)

    # 2. Get REAL Current Time in THAT Timezone
    store_now = datetime.now(tz)

    days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    day_name = days[store_now.weekday()]

    # 3. Check Hours
    hours = getattr(store, f"hours_{day_name}", None)
    if not hours or hours.lower() == "closed":
        return False

    try:
        current_time_str = store_now.strftime("%H:%M")
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
    query = db.query(models.Store)
    if store_type and store_type.lower() != "all":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    all_candidates = query.all()
    valid_stores = []

    for s in all_candidates:
        # Distance Check
        dist = None
        if lat and lon and radius_miles < 5000:
            dist = calculate_distance(lat, lon, s.latitude, s.longitude)
            if dist > radius_miles:
                continue
            s.distance_miles = dist
        else:
            s.distance_miles = None

        # Open Now Check (Timezone Aware)
        if open_now and not is_store_open(s):
            continue

        valid_stores.append(s)

    valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

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

            # FIELDS FOR FRONTEND
            "phone": s.phone,
            "hours_mon": s.hours_mon,
            "hours_tue": s.hours_tue,
            "hours_wed": s.hours_wed,
            "hours_thu": s.hours_thu,
            "hours_fri": s.hours_fri,
            "hours_sat": s.hours_sat,
            "hours_sun": s.hours_sun,
            "is_open": is_store_open(s)
        })

    return {"results": results, "total": total, "page": page, "limit": limit}


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 3958.8
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))