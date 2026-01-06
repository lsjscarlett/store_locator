from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, Index, Table
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

# --- Junction Tables ---
store_services = Table(
    'store_services', Base.metadata,
    Column('store_id', String, ForeignKey('stores.store_id')),
    Column('service_id', Integer, ForeignKey('services.id'))
)

role_permissions = Table(
    'role_permissions', Base.metadata,
    Column('role_id', Integer, ForeignKey('roles.id')),
    Column('permission_id', Integer, ForeignKey('permissions.id'))
)


# --- Service Model ---
class Service(Base):
    __tablename__ = "services"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True) # e.g., "wifi", "parking"


# --- Store Model ---
class Store(Base):
    __tablename__ = "stores"

    store_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    store_type = Column(String, nullable=False)
    status = Column(String, default="active")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address_street = Column(String)
    address_city = Column(String)
    address_state = Column(String)
    address_postal_code = Column(String, index=True)
    address_country = Column(String)
    phone = Column(String)
    timezone = Column(String, default="America/New_York")

    # FIX: lazy="joined" forces data to load immediately
    services = relationship("Service", secondary="store_services", back_populates="stores")

    hours_mon = Column(String)
    hours_tue = Column(String)
    hours_wed = Column(String)
    hours_thu = Column(String)
    hours_fri = Column(String)
    hours_sat = Column(String)
    hours_sun = Column(String)

    __table_args__ = (
        Index('idx_lat_lon', 'latitude', 'longitude'),
        Index('idx_active_stores', 'status', postgresql_where=(status == 'active')),
        Index('idx_store_type', 'store_type'),
        Index('idx_postal_code', 'address_postal_code'),
    )


# --- Auth Models ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    role_id = Column(Integer, ForeignKey("roles.id"))

    role = relationship("Role", back_populates="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user")


class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    users = relationship("User", back_populates="role")
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")


class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String, unique=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="refresh_tokens")