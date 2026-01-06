import json
import ssl
import certifi
from geopy.geocoders import Nominatim
from redis import Redis, RedisError

# 1. Setup SSL Context (The Fix for Mac)
ctx = ssl.create_default_context(cafile=certifi.where())

# 2. Connect to Redis
redis_client = Redis(host='localhost', port=6379, db=0, decode_responses=True)

# 3. Setup Geocoder with SSL Context
geolocator = Nominatim(
    user_agent="store_locator_project_v1",
    ssl_context=ctx  # <--- This solves the SSL Error
)


def get_coordinates(query: str):
    if not query:
        return None, None

    cache_key = f"geo:{query.lower().strip()}"

    # --- 1. SAFE Cache Check ---
    try:
        cached_val = redis_client.get(cache_key)
        if cached_val:
            print(f"   ⚡ Cache Hit for '{query}'")
            lat, lon = json.loads(cached_val)
            return lat, lon
    except (RedisError, ConnectionError):
        print(f"   ⚠ Redis is down. Skipping cache.")

    # --- 2. Call API ---
    try:
        print(f"    Calling Nominatim API for '{query}'...")
        # The geolocator now uses the 'ctx' we created above
        location = geolocator.geocode(query)

        if location:
            lat, lon = location.latitude, location.longitude

            # --- 3. SAFE Cache Save ---
            try:
                redis_client.setex(cache_key, 2592000, json.dumps((lat, lon)))
            except RedisError:
                pass

            return lat, lon

    except Exception as e:
        print(f"    Geocoding error: {e}")

    return None, None