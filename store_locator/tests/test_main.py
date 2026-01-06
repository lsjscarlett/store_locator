from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import patch
import io
from app.main import app, get_db
from app.database import Base
from app import models
from app.auth_utils import create_access_token, get_password_hash

# 1. Setup In-Memory Test Database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False
)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)
client = TestClient(app)


# --- TESTS ---

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Store Locator Service is Running"}


@patch("app.main.get_lat_lon")
def test_search_public(mock_geo):
    mock_geo.return_value = (40.7128, -74.0060)

    payload = {
        "address": "100 Main St, New York, NY",
        "zip_code": "10001",
        "page": 1,
        "limit": 10
    }
    response = client.post("/api/stores/search", json=payload)

    assert response.status_code == 200
    assert "results" in response.json()


def test_create_store_unauthorized():
    payload = {
        "store_id": "TEST-FAIL",
        "name": "Fail Store",
        "store_type": "regular",
        "address_street": "123 Fail St",
        "address_city": "Nowhere",
        "address_state": "NA",
        "address_postal_code": "00000",
        "address_country": "USA"
    }
    response = client.post("/api/admin/stores", json=payload)
    assert response.status_code == 401


@patch("app.main.get_lat_lon")
def test_admin_flow(mock_geo):
    mock_geo.return_value = (40.7128, -74.0060)

    # 1. SETUP USER
    db = TestingSessionLocal()

    # Ensure Role Exists
    admin_role = db.query(models.Role).filter_by(name="admin").first()
    if not admin_role:
        admin_role = models.Role(name="admin")
        db.add(admin_role)
        db.commit()

    # Create User
    admin_user = models.User(
        email="admin@test.com",
        password_hash=get_password_hash("password"),
        role=admin_role,
        is_active=True
    )
    db.add(admin_user)
    db.commit()

    token = create_access_token(
        data={"sub": admin_user.email, "role": "admin", "user_id": admin_user.id}
    )
    db.close()

    headers = {"Authorization": f"Bearer {token}"}

    # 2. CREATE STORE
    store_data = {
        "store_id": "TEST-PYTEST-001",
        "name": "Pytest Coffee",
        "store_type": "cafe",
        "address_street": "500 Test Blvd",
        "address_city": "Test City",
        "address_state": "TS",
        "address_postal_code": "12345",
        "address_country": "USA",
        "services": "wifi|parking"
    }

    response = client.post("/api/admin/stores", json=store_data, headers=headers)
    assert response.status_code == 201
    assert response.json()["name"] == "Pytest Coffee"

    # 3. GET STORE
    response = client.get("/api/admin/stores/TEST-PYTEST-001", headers=headers)
    assert response.status_code == 200


def test_csv_import_flow():
    # 1. Setup Admin Token (Reuse logic or abstract it)
    db = TestingSessionLocal()

    # Ensure Role exists
    role = db.query(models.Role).filter_by(name="admin").first()
    if not role:
        role = models.Role(name="admin")
        db.add(role)
        db.commit()

    # Ensure User exists
    admin = db.query(models.User).filter_by(email="admin_csv@test.com").first()
    if not admin:
        admin = models.User(email="admin_csv@test.com", password_hash="hash", role=role)
        db.add(admin)
        db.commit()

    token = create_access_token(data={"sub": admin.email, "role": "admin", "user_id": admin.id})
    db.close()

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Dummy CSV
    csv_content = """store_id,name,store_type,status,latitude,longitude,address_street,address_city,address_state,address_postal_code,address_country,phone,services
TEST-CSV-01,CSV Store,retail,active,40.7,-74.0,123 CSV Rd,Test City,TS,10001,USA,555-0199,wifi|parking
"""
    # Create a file-like object
    files = {
        'file': ('test_stores.csv', io.BytesIO(csv_content.encode('utf-8')), 'text/csv')
    }

    # 3. Post to Endpoint
    response = client.post("/api/admin/stores/import", files=files, headers=headers)

    assert response.status_code == 200
    stats = response.json()["stats"]
    assert stats["created"] == 1
    assert stats["errors"] == 0