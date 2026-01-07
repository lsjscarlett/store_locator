import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
import io

# Setup In-Memory DB
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    client.get("/seed_admin")
    yield
    Base.metadata.drop_all(bind=engine)

def get_admin_token():
    return client.post("/api/auth/login", json={"email": "admin@example.com", "role": "admin123"}).json()["access_token"]

# --- HAPPY PATH TESTS ---

def test_full_lifecycle():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Create
    store_data = {
        "store_id": "HAPPY_01", "name": "Happy Store", "store_type": "regular",
        "address_street": "123 St", "address_city": "City", "address_state": "NY",
        "address_postal_code": "10001", "status": "active", "services": ["wifi"]
    }
    assert client.post("/api/admin/stores", json=store_data, headers=headers).status_code == 201

    # Get
    assert client.get("/api/admin/stores/HAPPY_01", headers=headers).status_code == 200

    # Update
    assert client.patch("/api/admin/stores/HAPPY_01", json={"name": "Joy Store"}, headers=headers).status_code == 200

    # Search
    search = client.post("/api/stores/search", json={"zip_code": "10001", "page": 1, "filters": {"radius_miles": 50}})
    assert search.json()["results"][0]["name"] == "Joy Store"

    # Delete
    assert client.delete("/api/admin/stores/HAPPY_01", headers=headers).status_code == 204

# --- EDGE CASE TESTS ---

def test_edge_cases():
    token = get_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Duplicate Store ID
    # First create one
    client.post("/api/admin/stores", json={
        "store_id": "DUPE_01", "name": "Orig", "store_type": "regular",
        "address_street": "1 St", "address_city": "NY", "address_state": "NY", "address_postal_code": "10001", "status": "active"
    }, headers=headers)
    # Try create again
    dupe_res = client.post("/api/admin/stores", json={
        "store_id": "DUPE_01", "name": "Copy", "store_type": "regular",
        "address_street": "1 St", "address_city": "NY", "address_state": "NY", "address_postal_code": "10001", "status": "active"
    }, headers=headers)
    assert dupe_res.status_code == 400

    # 2. Get Non-Existent
    assert client.get("/api/admin/stores/GHOST_ID", headers=headers).status_code == 404

    # 3. Invalid Search Data
    invalid_res = client.post("/api/stores/search", json={"zip_code": "10001", "filters": {"radius_miles": "NOT_NUMBER"}})
    assert invalid_res.status_code == 422

    # 4. Security: Viewer Delete Attempt
    # Create Viewer
    client.post("/api/admin/users", json={"email": "viewer_py@test.com", "password": "pw", "role_id": 3, "is_active": True}, headers=headers)
    # Login Viewer
    viewer_token = client.post("/api/auth/login", json={"email": "viewer_py@test.com", "role": "pw"}).json()["access_token"]
    # Try Delete
    forbidden_res = client.delete("/api/admin/stores/DUPE_01", headers={"Authorization": f"Bearer {viewer_token}"})
    assert forbidden_res.status_code == 403