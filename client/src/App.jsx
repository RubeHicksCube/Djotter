import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
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
import QuickLogButton from './components/QuickLogButton';
import { FloatingOtterBottom } from './components/OtterDecorations';
import logo from './assets/logo.svg';

function AuthenticatedAppContent() {
  const { currentDate, isViewingHistoricalDate } = useCurrentDate();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // User Management modal state (available on all pages)
  const [showUserManagement, setShowUserManagement] = useState(false);

  // Export dropdown state
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Swipe navigation state
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Page navigation order
  const pages = ['/', '/trackers', '/profile'];
  const minSwipeDistance = 100;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const currentIndex = pages.indexOf(location.pathname);

    if (isLeftSwipe && currentIndex < pages.length - 1) {
      // Swipe left - go to next page
      navigate(pages[currentIndex + 1]);
    } else if (isRightSwipe && currentIndex > 0) {
      // Swipe right - go to previous page
      navigate(pages[currentIndex - 1]);
    }
  };

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

  const handleDownloadCSV = async () => {
    try {
      const date = isViewingHistoricalDate ? currentDate : null;
      // Note: This may need a new API endpoint
      if (api.downloadCSV) {
        await api.downloadCSV(date);
      } else {
        alert('CSV download not yet implemented');
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
      alert('Failed to download CSV');
    }
  };

  const handleDownloadZIP = async () => {
    try {
      const date = isViewingHistoricalDate ? currentDate : null;
      // Note: This may need a new API endpoint for combined ZIP
      if (api.downloadZIP) {
        await api.downloadZIP(date);
      } else {
        alert('ZIP download not yet implemented');
      }
    } catch (error) {
      console.error('Error downloading ZIP:', error);
      alert('Failed to download ZIP');
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
              <div className="nav-export-dropdown">
                <button
                  onClick={() => setExportMenuOpen(!exportMenuOpen)}
                  className="btn btn-sm btn-primary"
                  style={{ position: 'relative' }}
                >
                  📦 Export {exportMenuOpen ? '▲' : '▼'}
                </button>

                {exportMenuOpen && (
                  <div className="export-dropdown-menu">
                    <button onClick={() => { handleSaveSnapshot(); setExportMenuOpen(false); }} className="export-option">
                      💾 Save
                    </button>
                    <button onClick={() => { handleDownloadToday(); setExportMenuOpen(false); }} className="export-option">
                      📥 Markdown
                    </button>
                    <button onClick={() => { handleDownloadPDF(); setExportMenuOpen(false); }} className="export-option">
                      📄 PDF
                    </button>
                    <button onClick={() => { handleDownloadCSV(); setExportMenuOpen(false); }} className="export-option">
                      📊 CSV
                    </button>
                    <button onClick={() => { handleDownloadZIP(); setExportMenuOpen(false); }} className="export-option">
                      📦 ZIP (All)
                    </button>
                  </div>
                )}
              </div>
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

        <main
          style={{ paddingBottom: '450px' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
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

        {/* Quick Log Floating Action Button - Available on All Pages */}
        <QuickLogButton />
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
