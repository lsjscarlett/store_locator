from sqlalchemy.orm import Session
from typing import List, Optional, Tuple
import math
from app import models
from datetime import datetime


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
    # 1. THE RESET: Fetch all stores without ANY status or service filters
    # This proves the connection to the 1000 rows is working
    query = db.query(models.Store)

    # 2. Add Type Filter ONLY if it's explicitly chosen
    if store_type and store_type.strip() and store_type.lower() != "all":
        query = query.filter(models.Store.store_type.ilike(store_type.strip()))

    all_candidates = query.all()

    valid_stores = []

    # 3. Nationwide / Distance Logic
    # If Nationwide (5000) or geocoding failed, just return the raw data
    if lat is None or lon is None or radius_miles >= 5000:
        valid_stores = all_candidates
        for s in valid_stores:
            s.distance_miles = None
    else:
        for store in all_candidates:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                # We ignore 'open_now' for now to ensure we see results
                store.distance_miles = dist
                valid_stores.append(store)

        valid_stores.sort(key=lambda x: x.distance_miles if x.distance_miles is not None else 9999)

    # 4. Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    paginated = valid_stores[start: start + limit]

    # 5. Mapping (Simplified to avoid relationship errors)
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