from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
import pytest

# 1. Setup Test Database (In-Memory SQLite)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# 2. Override Dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

# 3. Create Tables
Base.metadata.create_all(bind=engine)

client = TestClient(app)


# --- TESTS ---

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Store Locator Service is Running"}


def test_seed_and_login():
    # 1. Seed Admin
    client.get("/seed_admin")

    # 2. Login
    login_data = {"email": "admin@example.com", "role": "admin123"}
    response = client.post("/api/auth/login", json=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return token


def test_create_store_manual():
    token = test_seed_and_login()
    headers = {"Authorization": f"Bearer {token}"}

    store_data = {
        "store_id": "TEST001",
        "name": "PyTest Store",
        "store_type": "regular",
        "address_street": "350 Fifth Ave",
        "address_city": "New York",
        "address_state": "NY",
        "address_postal_code": "10118",
        "status": "active",
        "services": ["wifi", "parking"]
    }

    response = client.post("/api/admin/stores", json=store_data, headers=headers)
    assert response.status_code == 201
    assert response.json()["name"] == "PyTest Store"
    # Check if geocoding worked (Latitude for NYC should be ~40.7)
    assert response.json()["latitude"] > 40.0


def test_search_stores():
    # Search for the store we just created
    search_payload = {
        "zip_code": "10118",
        "page": 1,
        "limit": 10,
        "filters": {
            "radius_miles": 10,
            "store_type": "regular",
            "services": ["wifi"]
        }
    }
    response = client.post("/api/stores/search", json=search_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert data["results"][0]["name"] == "PyTest Store"
    assert "wifi" in data["results"][0]["services"]


def test_delete_store():
    token = test_seed_and_login()
    headers = {"Authorization": f"Bearer {token}"}

    # Delete the test store
    response = client.delete("/api/admin/stores/TEST001", headers=headers)
    assert response.status_code == 204