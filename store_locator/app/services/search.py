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
def get_lat_lon(address: Optional[str], zip_code: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    geolocator = Nominatim(user_agent="my_locator_final_v3")

    # Clean the input
    query = f"{zip_code or address}"
    if not query: return None, None

    try:
        # Strategy 1: Search as a structured US query (Best for Zip/State/City)
        location = geolocator.geocode({"postalcode": query, "country": "USA"}, timeout=10)

        # Strategy 2: If that fails, try a free-form US search (Best for "California" or "123 Main St")
        if not location:
            location = geolocator.geocode(f"{query}, USA", timeout=10)

        if location:
            return location.latitude, location.longitude
    except Exception as e:
        print(f"Geocoding error: {e}")
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
    # 1. Start with an active stores query
    query = db.query(models.Store).filter(models.Store.status == "active")

    # 2. Filter by Store Type
    if store_type and store_type.strip() != "":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    # 3. Filter by Services
    if services and len(services) > 0:
        for service_name in services:
            query = query.filter(models.Store.services.any(name=service_name))

    current_time = datetime.now().strftime("%H:%M")
    all_candidates = query.all()
    valid_stores = []

    # 4. Calculate Distance and Filter
    if lat is not None and lon is not None:
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                # Check "Open Now" if requested
                if open_now and not is_store_open(store, current_time):
                    continue

                store.distance_miles = dist
                valid_stores.append(store)

        # --- CRITICAL FIX: SORT BY DISTANCE ---
        valid_stores.sort(key=lambda x: x.distance_miles)
    else:
        # If no coordinates (e.g., search failed), just return original list
        valid_stores = all_candidates
        for s in valid_stores:
            s.distance_miles = None

    # 5. Handle Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    end = start + limit
    paginated_results = valid_stores[start:end]

    # 6. Map to Frontend format
    final_results = []
    for s in paginated_results:
        # Handle services list to string mapping safely
        service_names = []
        if hasattr(s, 'services') and s.services:
            service_names = [svc.name for svc in s.services] if isinstance(s.services, list) else []

        final_results.append({
            "store_id": s.store_id,
            "name": s.name,
            "address_street": s.address_street,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "status": s.status,
            "distance": getattr(s, 'distance_miles', None),
            "store_type": s.store_type,
            "phone": getattr(s, 'phone', 'N/A'),
            "services": "|".join(service_names),
            "hours_mon": s.hours_mon,
            "hours_tue": s.hours_tue,
            "hours_wed": s.hours_wed,
            "hours_thu": s.hours_thu,
            "hours_fri": s.hours_fri,
            "hours_sat": s.hours_sat,
            "hours_sun": s.hours_sun,
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

