from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
import math
from app import models
from datetime import datetime
from geopy.geocoders import Nominatim # <--- CRITICAL MISSING IMPORT

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
    # 1. Start with a broad query to prove data exists
    query = db.query(models.Store)

    # 2. Add Type Filter ONLY if it's explicitly chosen
    if store_type and store_type.strip() and store_type.lower() != "all":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    all_candidates = query.all()

    # 3. Handle Geocoding Failure OR Nationwide Request
    # If lat/lon is None (Geocoder failed), we force it to show everything
    valid_stores = []
    if lat is None or lon is None or radius_miles >= 5000:
        valid_stores = all_candidates
        for s in valid_stores:
            s.distance_miles = None
    else:
        # 4. Proximity Logic
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                store.distance_miles = dist
                valid_stores.append(store)

        valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

    # 5. Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    paginated = valid_stores[start: start + limit]

    # 6. Mapping (The Fix for serialize_store crash)
    results = []
    for s in paginated:
        results.append({
            "store_id": s.store_id,
            "name": s.name,
            "address_street": s.address_street,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "distance": getattr(s, 'distance_miles', None),
            "store_type": s.store_type,
            "hours_mon": s.hours_mon
        })

    return {"results": results, "total": total, "page": page, "limit": limit}


def calculate_distance(lat1, lon1, lat2, lon2):
    R = 3958.8
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def get_lat_lon(query: str) -> Tuple[Optional[float], Optional[float]]:
    # Use a unique agent to prevent blocking
    geolocator = Nominatim(user_agent="my_retail_locator_final_v10")

    try:
        # Append USA to make sure it finds zip codes correctly
        search_term = f"{query}, USA"
        location = geolocator.geocode(search_term, timeout=10)

        if location:
            return location.latitude, location.longitude

    except Exception as e:
        print(f"GEOCODE ERROR: {e}")

    return None, None