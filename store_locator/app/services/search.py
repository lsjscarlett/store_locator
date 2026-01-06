from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Tuple
import redis
import math
from app import models
from app.config import settings
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

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
    geolocator = Nominatim(user_agent="store_locator_app")
    search_query = ""
    if address:
        search_query += address
    if zip_code:
        search_query += f" {zip_code}"

    try:
        location = geolocator.geocode(search_query, timeout=5)
        if location:
            return location.latitude, location.longitude
    except GeocoderTimedOut:
        return None, None
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
        limit: int
):
    query = db.query(models.Store).filter(models.Store.status == "active")

    # 1. Filter by Store Type
    if store_type:
        query = query.filter(models.Store.store_type == store_type)

    # 2. Filter by Services (Iterate and intersect)
    if services:
        for service_name in services:
            query = query.filter(models.Store.services.any(name=service_name))

    # 3. Get all candidates (before distance calc)
    # Note: For production with millions of rows, use PostGIS. 
    # For this scale, fetching all active stores to memory for distance sorting is acceptable.
    all_stores = query.all()

    # 4. Filter by Distance & Sort
    valid_stores = []
    if lat is not None and lon is not None:
        for store in all_stores:
            dist = calculate_distance(lat, lon, store.latitude, store.longitude)
            if dist <= radius_miles:
                # Attach distance dynamically to the object for reference
                store.distance_miles = dist
                valid_stores.append(store)

        # Sort by distance
        valid_stores.sort(key=lambda x: x.distance_miles)
    else:
        # If no location provided, just return paginated list
        valid_stores = all_stores

    # 5. Pagination
    total = len(valid_stores)
    start = (page - 1) * limit
    end = start + limit
    paginated_results = valid_stores[start:end]

    # 6. Return Structure (Matches schemas.SearchResponse)
    return {
        "results": paginated_results,
        "page": page,
        "limit": limit,
        "total": total
    }


# --- MATH HELPER ---
def calculate_distance(lat1, lon1, lat2, lon2):
    # Haversine formula
    R = 3958.8  # Earth radius in miles

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c