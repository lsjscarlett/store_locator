from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List, Optional


# --- 1. Search Schemas ---
class SearchFilters(BaseModel):
    radius_miles: float = 10.0
    store_type: Optional[str] = None
    services: Optional[List[str]] = None
    open_now: bool = False


class StoreSearchRequest(BaseModel):
    address: Optional[str] = None
    zip_code: Optional[str] = None
    page: int = 1
    limit: int = 10
    filters: SearchFilters = Field(default_factory=SearchFilters)


# --- 2. Store Base & Validators ---
class StoreBase(BaseModel):
    name: str
    store_type: str
    status: str = "active"
    address_street: Optional[str] = None
    address_city: Optional[str] = None
    address_state: Optional[str] = None
    address_postal_code: str
    address_country: str = "USA"
    phone: Optional[str] = None

    services: List[str] = []

    hours_mon: Optional[str] = "09:00-17:00"
    hours_tue: Optional[str] = "09:00-17:00"
    hours_wed: Optional[str] = "09:00-17:00"
    hours_thu: Optional[str] = "09:00-17:00"
    hours_fri: Optional[str] = "09:00-17:00"
    hours_sat: Optional[str] = "closed"
    hours_sun: Optional[str] = "closed"

    # CRITICAL: Converts Database Objects -> Strings
    @field_validator('services', mode='before')
    @classmethod
    def serialize_services(cls, v):
        if not v:
            return []
        if isinstance(v, str):
            return v.split("|")
        if isinstance(v, list):
            if len(v) > 0 and hasattr(v[0], "name"):
                return [s.name for s in v]
        return v


class StoreCreate(StoreBase):
    store_id: str


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    phone: Optional[str] = None
    services: Optional[List[str]] = None


class Store(StoreBase):
    store_id: str
    latitude: float
    longitude: float
    model_config = ConfigDict(from_attributes=True)


# --- 3. Response Schemas ---
class SearchResponse(BaseModel):
    results: List[Store]
    page: int
    limit: int
    total: int


# --- 4. User Schemas ---
class UserBase(BaseModel):
    email: str
    is_active: bool = True
    role_id: Optional[int] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class User(UserBase):
    id: int
    # Do not include password_hash in response
    model_config = ConfigDict(from_attributes=True)


# --- 5. Auth Schemas ---
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None


class RefreshRequest(BaseModel):
    refresh_token: str


# --- 6. ALIASES (The Fix for your errors) ---
# These map the names your main.py uses to the models defined above
SearchRequest = StoreSearchRequest
StoreResponse = Store
UserResponse = User  # Fixes "AttributeError: UserResponse"