import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import LocatorPage from "./pages/LocatorPage";
import AdminDashboard from "./pages/AdminDashboard"; // Import the real dashboard

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LocatorPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;