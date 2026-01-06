import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool

# Correct Absolute Imports
from app import main
from app import models
from app import auth_utils

# 1. Use an In-Memory SQLite Database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool # <--- CRITICAL: Keeps in-memory DB alive
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# 2. Database Fixture
@pytest.fixture(scope="function")
def db_session():
    """
    Creates a fresh database for every single test function.
    """
    models.Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # --- SEED TEST DATA ---

    # A. Create the Role first (Required for User)
    admin_role = models.Role(name="admin")
    db.add(admin_role)
    db.commit()  # Commit to generate the ID

    # B. Create the User linked to the Role
    admin_user = models.User(
        email="admin@test.com",
        password_hash=auth_utils.get_password_hash("test1234"),
        role_id=admin_role.id  # <--- Link to the real Role ID
    )

    # C. Create a Test Store
    test_store = models.Store(
        store_id="TEST01",
        name="Test Store",
        store_type="regular",
        status="active",
        latitude=42.0,
        longitude=-71.0,
        address_city="Test City"
    )

    db.add(admin_user)
    db.add(test_store)
    db.commit()

    yield db

    # Cleanup
    db.close()
    models.Base.metadata.drop_all(bind=engine)


# 3. Client Fixture
@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    main.app.dependency_overrides[main.get_db] = override_get_db
    with TestClient(main.app) as c:
        yield c