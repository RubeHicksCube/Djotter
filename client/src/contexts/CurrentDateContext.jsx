import React, { createContext, useContext, useState } from 'react';

const CurrentDateContext = createContext();

export function CurrentDateProvider({ children }) {
  const [currentDate, setCurrentDate] = useState(null); // null = today
  const [isViewingHistoricalDate, setIsViewingHistoricalDate] = useState(false);

  const value = {
    currentDate,
    setCurrentDate,
    isViewingHistoricalDate,
    setIsViewingHistoricalDate,
    resetToToday: () => {
      setCurrentDate(null);
      setIsViewingHistoricalDate(false);
    }
  };

  return (
    <CurrentDateContext.Provider value={value}>
      {children}
    </CurrentDateContext.Provider>
  );
}

export function useCurrentDate() {
  const context = useContext(CurrentDateContext);
  if (!context) {
    throw new Error('useCurrentDate must be used within CurrentDateProvider');
  }
  return context;
}
