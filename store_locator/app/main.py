from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import csv
import codecs
import json
import hashlib
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
import os

# Internal modules
from .database import engine, get_db
from . import models, schemas
from .config import settings
from .services.search import search_stores_logic, redis_client, get_lat_lon
from .auth_utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_user
)
from .utils import process_services, check_is_open

# 1. Create Database Tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Store Locator API")

origins = [
    "https://storelocatorfrontend-production.up.railway.app",
    "http://localhost:3000",
    "http://localhost:5173",
]

# 2. Middleware (CORS & Rate Limiter)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- 1. HEALTH CHECK ---
@app.get("/")
def health_check():
    return {"status": "ok", "message": "Store Locator Service is Running"}


# --- 2. PUBLIC SEARCH ---
# --- 2. PUBLIC SEARCH ---
@app.post("/api/stores/search")
@limiter.limit("100/minute")
def search_stores(
        payload: schemas.SearchRequest,
        request: Request,
        db: Session = Depends(get_db)
):
    try:
        # Cache Key Generation
        payload_str = payload.model_dump_json()
        query_hash = hashlib.md5(payload_str.encode()).hexdigest()
        cache_key = f"search_results:{query_hash}"

        # Check Redis
        if redis_client:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)

        # Geocode if needed
        lat, lon = None, None
        if payload.address or payload.zip_code:
            # FIX HERE: Changed search_logic to search
            from app.services.search import get_lat_lon, search_stores_logic
            lat, lon = get_lat_lon(payload.address, payload.zip_code)

        # Search Logic
        # Note: Added explicit keyword arguments to be safe
        from app.services.search import search_stores_logic
        results = search_stores_logic(
            db=db,
            lat=lat,
            lon=lon,
            radius_miles=payload.filters.radius_miles,
            store_type=payload.filters.store_type,
            services=payload.filters.services,
            page=payload.page,
            limit=payload.limit
        )

        # Save to Redis (TTL 5 mins)
        if redis_client and results:
            redis_client.setex(cache_key, 300, json.dumps(results, default=str))

        return results

    except Exception as e:
        import traceback
        print(f"CRITICAL SEARCH ERROR: {str(e)}")
        print(traceback.format_exc()) # This will show exactly which line failed in Railway Logs
        return {"error": str(e), "results": [], "total": 0, "page": 1, "limit": 10}


# --- 3. AUTHENTICATION ---
@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: schemas.TokenData, db: Session = Depends(get_db)):
    # Note: Using simpler TokenData for JSON input instead of Form data
    user = db.query(models.User).filter(models.User.email == form_data.email).first()
    if not user or not verify_password(form_data.role, user.password_hash):
        # Note: In this project, we are using the 'role' field in TokenData as the password input for simplicity
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token = create_access_token(data={"sub": user.email, "role": user.role.name, "user_id": user.id})
    refresh_token = create_refresh_token(data={"sub": user.email})

    # Save Refresh Token
    db_token = models.RefreshToken(
        token_hash=get_password_hash(refresh_token),
        user_id=user.id
    )
    db.add(db_token)
    db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@app.post("/api/auth/refresh", response_model=schemas.Token)
def refresh_token(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    email = verify_refresh_token(payload.refresh_token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_access_token = create_access_token(data={"sub": user.email, "role": user.role.name, "user_id": user.id})
    return {"access_token": new_access_token, "refresh_token": payload.refresh_token, "token_type": "bearer"}


# --- 4. ADMIN: STORE MANAGEMENT ---
@app.post("/api/admin/stores", response_model=schemas.StoreResponse, status_code=201)
def create_store(
        store: schemas.StoreCreate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role.name not in ["admin", "marketer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if db.query(models.Store).filter(models.Store.store_id == store.store_id).first():
        raise HTTPException(status_code=400, detail="Store ID exists")

    lat, lon = 0.0, 0.0
    if store.address_postal_code:
        lat, lon = get_lat_lon(None, store.address_postal_code)

    # Process Services
    service_objs = process_services(db, store.services)

    # Convert Pydantic model to Dict, exclude services (handled separately)
    store_data = store.model_dump(exclude={"services"})

    new_store = models.Store(
        **store_data,
        latitude=lat,
        longitude=lon,
        services=service_objs
    )

    db.add(new_store)
    db.commit()
    db.refresh(new_store)
    return new_store


@app.get("/api/admin/stores/{store_id}", response_model=schemas.StoreResponse)
def get_store(store_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    store = db.query(models.Store).filter(models.Store.store_id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return store


@app.patch("/api/admin/stores/{store_id}", response_model=schemas.StoreResponse)
def update_store(
        store_id: str,
        payload: schemas.StoreUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role.name not in ["admin", "marketer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    store = db.query(models.Store).filter(models.Store.store_id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Handle Services separately if present
    if "services" in update_data:
        store.services = process_services(db, update_data.pop("services"))

    for key, value in update_data.items():
        setattr(store, key, value)

    db.commit()
    db.refresh(store)
    return store


@app.delete("/api/admin/stores/{store_id}", status_code=204)
def delete_store(store_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role.name not in ["admin", "marketer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    store = db.query(models.Store).filter(models.Store.store_id == store_id).first()
    if store:
        store.status = "inactive"  # Soft Delete
        db.commit()
    return


# --- 5. ADMIN: USER MANAGEMENT ---
@app.post("/api/admin/users", response_model=schemas.UserResponse, status_code=201)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(get_current_user)):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email registered")

    # Resolve Role ID
    role_id = user.role_id
    if not role_id:
        # Default to viewer if not specified
        viewer_role = db.query(models.Role).filter(models.Role.name == "viewer").first()
        role_id = viewer_role.id if viewer_role else None

    hashed_pw = get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        password_hash=hashed_pw,
        role_id=role_id,
        is_active=user.is_active
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.get("/api/admin/users", response_model=List[schemas.UserResponse])
def list_users(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    return db.query(models.User).all()


@app.put("/api/admin/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
        user_id: int,
        user_update: schemas.UserUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.role_id is not None:
        user.role_id = user_update.role_id

    if user_update.is_active is not None:
        if user.id == current_user.id and user_update.is_active is False:
            raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
        user.is_active = user_update.is_active

    db.commit()
    db.refresh(user)
    return user


# --- 6. IMPORT ---
@app.post("/api/admin/stores/import")
def import_stores(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role.name not in ["admin", "marketer"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    csv_reader = csv.DictReader(codecs.iterdecode(file.file, 'utf-8-sig'))
    stats = {"created": 0, "updated": 0, "errors": 0}

    for row in csv_reader:
        try:
            store_id = row.get("store_id")
            if not store_id: continue

            existing = db.query(models.Store).filter(models.Store.store_id == store_id).first()
            service_objs = process_services(db, row.get("services", ""))

            def safe_float(v):
                try:
                    return float(v)
                except:
                    return 0.0

            if existing:
                existing.name = row["name"]
                existing.store_type = row["store_type"]
                existing.status = row["status"]
                existing.phone = row["phone"]
                existing.services = service_objs
                stats["updated"] += 1
            else:
                new_store = models.Store(
                    store_id=store_id,
                    name=row["name"],
                    store_type=row["store_type"],
                    status=row["status"],
                    latitude=safe_float(row["latitude"]),
                    longitude=safe_float(row["longitude"]),
                    address_street=row["address_street"],
                    address_city=row["address_city"],
                    address_state=row["address_state"],
                    address_postal_code=row["address_postal_code"],
                    address_country=row["address_country"],
                    phone=row["phone"],
                    services=service_objs,
                    hours_mon=row.get("hours_mon"),
                    hours_tue=row.get("hours_tue"),
                    hours_wed=row.get("hours_wed"),
                    hours_thu=row.get("hours_thu"),
                    hours_fri=row.get("hours_fri"),
                    hours_sat=row.get("hours_sat"),
                    hours_sun=row.get("hours_sun")
                )
                db.add(new_store)
                stats["created"] += 1
        except Exception as e:
            print(f"Row Error: {e}")
            stats["errors"] += 1

    db.commit()
    return {"message": "Import completed", "stats": stats}