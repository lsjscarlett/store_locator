### 2. Frontend README (`frontend/README.md`)
*This explains the React App, Map logic, and Admin Dashboard.*


# Store Locator Frontend

A responsive web application built with **React** and **Vite** that provides an interactive map interface for finding retail locations.

##  Tech Stack
* **Core:** React.js (Vite)
* **Styling:** Tailwind CSS
* **Maps:** Leaflet.js & React-Leaflet
* **HTTP:** Axios (with Interceptors for Auto-Refresh Tokens)

## 🛠 Setup & Installation

1.  **Navigate to the folder:**
    ```bash
    cd frontend
    ```

2.  **Install Packages:**
    ```bash
    npm install
    ```

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:5173`.

##  Features

### 1. Public Locator
* **Interactive Map:** Pins update dynamically based on search results.
* **Smart Hover:** Hovering over a store card highlights the pin on the map.
* **Filters:** Filter by Radius, Store Type, and Services (WiFi, etc.).
* **Error Hinting:** Detects vague addresses (e.g., "Elm St") and prompts the user to add a City/Zip.

### 2. Admin Dashboard (`/admin`)
* **Authentication:** Protected route requiring login.
* **Store Management:**
    * **Import:** Drag-and-drop CSV upload.
    * **Create:** Manual form with auto-geocoding.
    * **Delete:** Remove outdated locations.
* **User Management:** Create Admins, Marketers, or Viewers.

## ⚙ Configuration
The API connection is defined in `src/api/axios.js`.
Ensure `baseURL` matches your deployed backend (e.g., Railway URL).