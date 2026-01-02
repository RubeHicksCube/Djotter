import { useState, useEffect, useRef } from 'react';
import { useUserSettings } from '../contexts/UserSettingsContext';

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
  { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris/Berlin/Rome' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Kolkata', label: 'India' },
  { value: 'Asia/Shanghai', label: 'China/Beijing' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export default function SettingsDropdown({ username, isDarkMode, onThemeChange, isAdmin, onOpenUserManagement }) {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, updateSettings, loading } = useUserSettings();
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const updateSetting = async (key, value) => {
    const newSettings = { [key]: value };
    await updateSettings(newSettings);

    // Apply theme change immediately
    if (key === 'theme') {
      onThemeChange(value === 'dark');
    }
  };

  return (
    <div className="settings-dropdown" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="settings-trigger"
        aria-label="Settings"
      >
        👤 {username} ▼
      </button>

      {isOpen && (
        <div className="settings-menu">
          <div className="settings-menu-header">
            <h3>Settings</h3>
          </div>

          <div className="settings-menu-content">
            {/* Theme Toggle */}
            <div className="settings-item">
              <label className="settings-label">Theme</label>
              <div className="settings-control">
                <button
                  onClick={() => updateSetting('theme', settings.theme === 'dark' ? 'light' : 'dark')}
                  className="btn btn-sm btn-secondary"
                  style={{ minWidth: '100px' }}
                >
                  {settings.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              </div>
            </div>

            {/* Timezone Selector */}
            <div className="settings-item">
              <label className="settings-label">Timezone</label>
              <div className="settings-control">
                <select
                  value={settings.timezone}
                  onChange={(e) => updateSetting('timezone', e.target.value)}
                  className="form-select"
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-save Toggle */}
            <div className="settings-item">
              <label className="settings-label">
                Auto-save before refresh
              </label>
              <div className="settings-control">
                <label className="settings-checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => updateSetting('autoSave', e.target.checked)}
                  />
                  <span style={{ marginLeft: '0.5rem' }}>
                    {settings.autoSave ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            {/* User Management (Admin Only) */}
            {isAdmin && onOpenUserManagement && (
              <>
                <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }}></div>
                <div className="settings-item">
                  <button
                    onClick={() => {
                      onOpenUserManagement();
                      setIsOpen(false);
                    }}
                    className="btn btn-sm btn-primary"
                    style={{ width: '100%' }}
                  >
                    👥 User Management
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
