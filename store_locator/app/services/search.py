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

    # 2. Filter by Store Type (if the user selected one)
    if store_type:
        query = query.filter(models.Store.store_type == store_type)

    # 3. Filter by Services
    if services and len(services) > 0:
        for service_name in services:
            # This assumes a many-to-many relationship with a 'name' field
            query = query.filter(models.Store.services.any(name=service_name))

    current_time = datetime.now().strftime("%H:%M")

    # 4. Fetch results to calculate distances
    all_candidates = query.all()
    valid_stores = []

    if lat is not None and lon is not None:
        for store in all_candidates:
            # 1. Check Distance
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                # 2. Check "Open Now" if requested
                if open_now and not is_store_open(store, current_time):
                    continue

                store.distance_miles = dist
                valid_stores.append(store)
    else:
        # If geocoding failed, just return the first 'limit' stores without distance
        valid_stores = all_candidates
        for s in valid_stores:
            s.distance_miles = None

    # 5. Handle Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    end = start + limit
    paginated_results = valid_stores[start:end]

    # 6. Map to the final dictionary format for the Frontend
    final_results = []
    for s in paginated_results:
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
            "services": "|".join([svc.name for svc in s.services]) if hasattr(s, 'services') and isinstance(s.services,
                                                                                                            list) else "",
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
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def is_store_open(store):
    # 1. Get current day (mon, tue, etc.) and time (HH:MM)
    now = datetime.now()
    day_name = now.strftime("%a").lower()  # e.g., "mon"
    current_time = now.strftime("%H:%M")  # e.g., "14:30"

    # 2. Get hours for today from the store object
    hours_str = getattr(store, f"hours_{day_name}", "closed")

    if not hours_str or hours_str.lower() == "closed":
        return False

    try:
        # Split "09:00-17:00" into "09:00" and "17:00"
        opening, closing = hours_str.split("-")
        # Direct string comparison works perfectly for 24-hour "HH:MM" format
        return opening <= current_time <= closing
    except Exception:
        return False

