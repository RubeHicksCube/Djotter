import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { api } from './services/api';
import { UserSettingsProvider } from './contexts/UserSettingsContext';
import { CurrentDateProvider, useCurrentDate } from './contexts/CurrentDateContext';
import Home from './pages/Home';
import Trackers from './pages/Trackers';
import LoginPage from './pages/LoginPage';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import SettingsDropdown from './components/SettingsDropdown';
import UserManagementModal from './components/UserManagementModal';
import { FloatingOtterBottom } from './components/OtterDecorations';
import logo from './assets/logo.svg';

function AuthenticatedAppContent() {
  const { currentDate, isViewingHistoricalDate } = useCurrentDate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // User Management modal state (available on all pages)
  const [showUserManagement, setShowUserManagement] = useState(false);

  useEffect(() => {
    // Check authentication on mount
    if (!api.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }

    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    // Load theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsDarkMode(false);
      document.body.classList.add('light-mode');
    } else {
      setIsDarkMode(true);
      document.body.classList.remove('light-mode');
    }

    setLoading(false);
  }, []);

  // User Management handlers (available on all pages)
  const handleOpenUserManagement = () => {
    setShowUserManagement(true);
  };

  const handleCloseUserManagement = () => {
    setShowUserManagement(false);
  };

  const toggleTheme = (darkMode) => {
    // If called with a parameter, use it; otherwise toggle
    const newTheme = darkMode !== undefined ? darkMode : !isDarkMode;
    setIsDarkMode(newTheme);

    if (newTheme) {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = () => {
    api.logout();
  };

  const handleDownloadToday = () => {
    if (currentDate && isViewingHistoricalDate) {
      // Export the currently viewed date
      api.downloadDateRange(currentDate, currentDate);
    } else {
      // Export today
      api.downloadMarkdown();
    }
  };

  const handleDownloadPDF = () => {
    if (currentDate && isViewingHistoricalDate) {
      // Export the currently viewed date as PDF
      api.downloadDateRangePDF(currentDate, currentDate);
    } else {
      // Export today as PDF
      api.downloadPDF();
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      await api.saveSnapshot();
      alert('Snapshot saved successfully!');
    } catch (error) {
      console.error('Error saving snapshot:', error);
      alert('Error saving snapshot');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app">
      <FloatingOtterBottom />
      <nav className="nav">
          <div className="nav-container">
            <NavLink to="/" className="nav-brand">
              <img src={logo} alt="Djotter" style={{ width: '24px', height: '24px', marginRight: '8px', verticalAlign: 'middle' }} />
              Djotter
            </NavLink>

            {/* Hamburger Menu Button */}
            <button
              className="nav-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
              <span className={`hamburger-line ${mobileMenuOpen ? 'open' : ''}`}></span>
            </button>

            {/* Navigation Links */}
            <ul className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
              <li><NavLink to="/" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Home</NavLink></li>
              <li><NavLink to="/trackers" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Trackers</NavLink></li>
              <li><NavLink to="/profile" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Profile</NavLink></li>
            </ul>

            {/* Action Buttons */}
            <div className={`nav-actions ${mobileMenuOpen ? 'mobile-open' : ''}`}>
              <button onClick={handleSaveSnapshot} className="btn btn-sm btn-warning" title="Save today's snapshot">
                💾 Save
              </button>
              <button onClick={handleDownloadToday} className="btn btn-sm btn-success" title="Download today's markdown">
                📥 Markdown
              </button>
              <button onClick={handleDownloadPDF} className="btn btn-sm btn-success" title="Download today's PDF">
                📄 PDF
              </button>
              {user && (
                <>
                  <SettingsDropdown
                    username={user.username}
                    isDarkMode={isDarkMode}
                    onThemeChange={toggleTheme}
                    isAdmin={user.is_admin}
                    onOpenUserManagement={handleOpenUserManagement}
                  />
                  <button onClick={handleLogout} className="btn btn-sm btn-secondary">Logout</button>
                </>
              )}
            </div>
          </div>
        </nav>

        <main style={{ paddingBottom: '450px' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/trackers" element={<Trackers />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* User Management Modal - Available on All Pages */}
        <UserManagementModal
          isOpen={showUserManagement}
          onClose={handleCloseUserManagement}
          currentUser={user}
        />
      </div>
  );
}

function AuthenticatedApp() {
  return (
    <UserSettingsProvider>
      <CurrentDateProvider>
        <AuthenticatedAppContent />
      </CurrentDateProvider>
    </UserSettingsProvider>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </Router>
  );
}

export default App;
