import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const UserSettingsContext = createContext();

export function UserSettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    theme: 'dark',
    timezone: 'UTC',
    autoSave: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userSettings = await api.getUserSettings();
      setSettings(userSettings);
      setLoading(false);
    } catch (error) {
      console.error('Error loading user settings:', error);
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      await api.updateUserSettings(updated);
    } catch (error) {
      console.error('Error updating settings:', error);
      // Revert on error
      loadSettings();
    }
  };

  return (
    <UserSettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  const context = useContext(UserSettingsContext);
  if (!context) {
    throw new Error('useUserSettings must be used within UserSettingsProvider');
  }
  return context;
}
