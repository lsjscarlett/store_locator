from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
import math
from app import models
from geopy.geocoders import Nominatim
from datetime import datetime


# --- GEOCODER HELPER ---
def get_lat_lon(query: str) -> Tuple[Optional[float], Optional[float]]:
    geolocator = Nominatim(user_agent="my_locator_final_v4")
    try:
        # Search USA specifically
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
        services: Optional[List[str]],  # Kept for signature compatibility
        page: int,
        limit: int,
        open_now=False
):
    # 1. Start with active stores
    # Using ilike("active") handles 'active', 'Active', etc.
    query = db.query(models.Store).filter(models.Store.status.ilike("active"))

    # 2. Filter by Store Type (Only if not empty)
    if store_type and store_type.strip() and store_type.lower() != "all":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    all_candidates = query.all()

    # SAFETY: If 'active' status is missing in DB, fetch everything
    if not all_candidates:
        all_candidates = db.query(models.Store).all()

    valid_stores = []
    current_time = datetime.now().strftime("%H:%M")

    # 3. Distance & Nationwide Logic
    # If radius is 5000 (Nationwide) or geocoding failed, skip distance filter
    if lat is None or lon is None or radius_miles >= 5000:
        valid_stores = all_candidates
        for s in valid_stores:
            s.distance_miles = None
    else:
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                if open_now and not is_store_open(store, current_time):
                    continue
                store.distance_miles = dist
                valid_stores.append(store)

        # Sort closest first
        valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

    # 4. Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    paginated_results = valid_stores[start:start + limit]

    # 5. Mapping
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