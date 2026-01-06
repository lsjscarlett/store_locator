# 📍 Store Locator Full-Stack Application

A high-performance store locator system featuring a **FastAPI** backend, **React** frontend, **PostgreSQL** database, and **Redis** caching. This application enables users to find stores via geocoded search and allows administrators to manage store data through a secure dashboard.

**Live Frontend:** [https://storelocatorfrontend-production.up.railway.app](https://storelocatorfrontend-production.up.railway.app)  
**API Documentation (Swagger):** [https://storelocatorbackend-production.up.railway.app/docs](https://storelocatorbackend-production.up.railway.app/docs)

---

## 🏗 Architecture Overview

The application follows a modern decoupled architecture:

* **Frontend:** React (Vite) + Leaflet.js for interactive mapping.
* **Backend:** FastAPI (Python 3.9+) with asynchronous request handling.
* **Database:** PostgreSQL (Relational storage for 1,000+ stores).
* **Cache:** Redis (Caching search results via MD5 payload hashing to optimize performance).
* **Security:** JWT (JSON Web Tokens) with Bcrypt password hashing.



---

## 🚀 Key Technical Choices

### 1. Framework Choice: FastAPI & React
* **Backend:** FastAPI was chosen for its native support for asynchronous programming and automatic OpenAPI/Swagger documentation generation, which accelerated front-to-back integration.
* **Frontend:** Vite was used over CRA (Create React App) for significantly faster build times and optimized asset "baking" for production.

### 2. CSV Processing (Requirement 6.1)
* **Choice:** Python's built-in `csv` module.
* **Rationale:** To minimize deployment overhead and container size, the built-in module was used instead of Pandas. It efficiently handles the batch import of 1,000+ records without high memory consumption.

### 3. Distance Calculation (Requirement 4.2)
* **Method:** **Haversine Formula**.
* **Description:** Implemented within the search service to calculate the great-circle distance between two points on a sphere. This allows for accurate radius filtering (e.g., "within 50 miles") without requiring complex GIS database extensions.

---

## 🔐 Authentication & Security

* **Flow:** The application uses a secure OAuth2 flow. Users login via `/api/auth/login` to receive an Access Token.
* **RBAC (Role-Based Access Control):** Permissions are strictly enforced at the API level using FastAPI dependencies. 
    * **Admin:** Full CRUD access and user management.
    * **Marketer:** Access to store updates and CSV imports.
    * **Viewer:** Read-only access to the dashboard.
* **CORS:** Cross-Origin Resource Sharing is strictly configured to allow the production frontend origin while blocking unauthorized external domains.



---

## 🛠 Setup and Installation

### Local Development
1.  **Clone the repository.**
2.  **Backend Setup:**
    ```bash
    cd store_locator
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    ```
3.  **Frontend Setup:**
    ```bash
    cd store_locator_frontend
    npm install
    npm run dev
    ```

### Environment Variables (`.env`)
The following variables must be set for the application to function:
* `DATABASE_URL`: PostgreSQL connection string.
* `REDIS_URL`: Redis connection string.
* `SECRET_KEY`: Random string for JWT signing.
* `VITE_API_URL`: The full URL of your backend (e.g., `https://backend.up.railway.app`).

---

## 🏁 Deployment Information

* **Platform:** Railway (PaaS)
* **Health Check:** A dedicated `/` endpoint returns `{"status": "ok"}` to verify service availability.
* **Credentials for Testing:**
    * **Admin Email:** `admin@example.com`
    * **Password:** `admin123`

---

## 🧪 Testing Suite
* **Tool:** `pytest`
* **Run command:** `pytest app/tests`
* **Coverage:** Includes validation for authentication logic, distance calculation accuracy, and CSV parsing integrity.


## 📊 Database Schema

The database consists of five core tables designed for Role-Based Access Control (RBAC) and store data management.

| Table | Primary Key | Key Columns | Relationships |
| :--- | :--- | :--- | :--- |
| **Stores** | `store_id` | `name`, `latitude`, `longitude`, `status`, `address` | Many-to-Many with **Services** |
| **Users** | `id` | `email`, `password_hash`, `is_active`, `role_id` | Belongs to **Role** |
| **Roles** | `id` | `name` (admin, marketer, viewer) | Has many **Users** / **Permissions** |
| **Services** | `id` | `name` (e.g., "WiFi", "Drive-Thru") | Many-to-Many with **Stores** |
| **RefreshTokens** | `id` | `token_hash`, `user_id`, `expires_at` | Belongs to **User** |


---

## 📡 Sample API Requests & Responses

### 1. Store Search (Public)
**Endpoint:** `POST /api/stores/search`  
**Request Body:**
```json
{
  "zip_code": "10036",
  "filters": {
    "radius_miles": 50,
    "store_type": "retail"
  }
}
```

Response (200 OK)
```json
{
  "results": [
    {
      "store_id": "STORE-0157",
      "name": "Flagship New York",
      "latitude": 40.7589,
      "longitude": -73.9851,
      "distance": 0.45
    }
  ],
  "total": 1,
  "page": 1
}
```

2. Admin Login
Endpoint: POST /api/auth/login

Request Body:

```json
{
  "email": "admin@example.com",
  "role": "admin123"
}
```
Response (200 OK):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "def456...",
  "token_type": "bearer"
}
```

3. CSV Import (Admin Only)
Endpoint: POST /api/admin/stores/import

Header: Authorization: Bearer <access_token>

Body: multipart/form-data (file: stores.csv)

Response (200 OK):

```json
{
  "message": "Import completed",
  "stats": {
    "created": 150,
    "updated": 12,
    "errors": 0
  }
}
```