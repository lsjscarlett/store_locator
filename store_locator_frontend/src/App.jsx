import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LocatorPage from './pages/LocatorPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Map */}
        <Route path="/" element={<LocatorPage />} />

        {/* Login Screen */}
        <Route path="/login" element={<LoginPage />} />

        {/* Admin Dashboard */}
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;