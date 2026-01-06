# 📍 Intelligent Store Locator API

A production-grade, RESTful Store Locator backend built with **FastAPI**, **PostgreSQL (PostGIS logic)**, and **Redis**.

This project demonstrates advanced backend patterns including Geospatial searching, Multi-tiered Caching, JWT Authentication with Refresh Tokens, Role-Based Access Control (RBAC), and Batch Data Processing.

---

## 🚀 Key Features

### 1. Public Search API 🌍
- **Geospatial Search:** Calculates distances using the Haversine formula to find stores near a point.
- **Auto-Geocoding:** Automatically converts addresses (e.g., "New York, NY") to coordinates (Lat/Lon) if not provided.
- **Smart Caching:** Redis caches search queries (TTL 5 mins) to optimize performance for frequent searches.
- **Filtering:** Filter results by radius, store type, and services.

### 2. Enterprise Security 🔐
- **JWT Authentication:** Secure stateless auth with Access Tokens (15 min) and Refresh Tokens (7 days).
- **Role-Based Access Control (RBAC):**
  - `Admin`: Full system access (Users, Stores, Import).
  - `Marketer`: Store management and imports.
  - `Viewer`: Read-only access.
- **Protection:** Password hashing (bcrypt), Rate Limiting (SlowAPI), and CORS configuration.

### 3. Data Management 🛠️
- **CRUD Operations:** Full management API for Stores and Users.
- **Batch Processing:** High-performance CSV importer capable of upserting 1,000+ records in seconds.
- **Strict Validation:** Pydantic models ensure data integrity (e.g., preventing address changes during partial updates).

---

## 🛠️ Technology Stack

- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Database:** PostgreSQL 15 (Dockerized)
- **Cache:** Redis 7 (Dockerized)
- **ORM:** SQLAlchemy
- **Testing:** Pytest
- **Containerization:** Docker & Docker Compose

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- Docker Desktop installed and running.
- Python 3.11+ installed.

### 2. Environment Setup
Create a `.env` file in the root directory:
```ini
DATABASE_URL=postgresql://postgres:password@127.0.0.1/store_locator
SECRET_KEY=super_secret_key_123
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REDIS_HOST=localhost
REDIS_PORT=6379