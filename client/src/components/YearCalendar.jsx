import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

function YearCalendar({ availableDates, formatDateDisplay }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Generate activity data for each day of the year
  const getActivityData = (year) => {
    const activityData = {};
    
    // Initialize all days with empty activity
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);
    
    for (let d = new Date(startOfYear); d <= endOfYear; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      activityData[dateStr] = {
        hasSnapshot: false,
        hasActivity: false,
        activityCount: 0,
        activities: []
      };
    }
    
    // Fill in actual activity data
    availableDates.forEach(date => {
      if (activityData[date]) {
        activityData[date].hasSnapshot = true;
        activityData[date].activityCount += 1;
      }
    });
    
    return activityData;
  };

  // Generate calendar days with GitHub-style contribution graph
  const generateCalendarDays = (year) => {
    const activityData = getActivityData(year);
    const firstDay = new Date(year, 0, 1).getDay();
    const daysInMonth = 32 + firstDay; // December always has 31 days
    const calendar = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      calendar.push(
        <div key={`empty-${i}`} className="calendar-day empty" style={{ visibility: 'hidden' }}></div>
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, 11, day);
      const dateStr = date.toISOString().split('T')[0];
      const activity = activityData[dateStr] || { hasSnapshot: false, hasActivity: false, activityCount: 0 };
      
      // Calculate contribution level (0-5 scale like GitHub)
      let level = 0;
      if (activity.hasSnapshot) {
        level = 3; // Green for snapshot
      } else if (activity.hasActivity) {
        level = Math.min(activity.activityCount, 4); // Scale with activity count
      }

      calendar.push(
        <div 
          key={dateStr} 
          className={`calendar-day ${activity.hasSnapshot ? 'has-snapshot' : activity.hasActivity ? 'has-activity' : 'no-activity'}`}
          style={{ backgroundColor: `rgba(76, 175, 80, ${0.1 + level * 0.12})` }}
          title={`${dateStr}${activity.hasSnapshot ? ' (has snapshot)' : activity.hasActivity ? ` (${activity.activityCount} activities)` : ''}`}
        >
          <div className="calendar-day-number">{day}</div>
          {activity.hasSnapshot && (
            <div className="contribution-indicator">📸</div>
          )}
        </div>
      );
    }

    // Add remaining cells to complete the grid
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const remainingCells = totalCells - (firstDay + daysInMonth);
    for (let i = 0; i < remainingCells; i++) {
      calendar.push(
        <div 
          key={`empty-end-${i}`} 
          className="calendar-day empty" 
          style={{ visibility: 'hidden' }}
        ></div>
      );
    }

    return calendar;
  };

  // Add navigation for different years
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
      years.push(year);
    }
    
    return years;
  };

  const calendarDays = generateCalendarDays(selectedYear);

  return (
    <div>
      {/* Year Selector and Legend */}
      <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <label style={{ fontSize: '1rem', fontWeight: '500' }}>Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="form-input"
            style={{ padding: '0.5rem 1rem' }}
          >
            {generateYearOptions().map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: '#4CAF50', 
              borderRadius: '50%' 
            }}></div>
            <span>📸 Has Snapshot</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: 'var(--bg-primary)', 
              borderRadius: '50%' 
            }}></div>
            <span>Activity</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              backgroundColor: '#FFC107', 
              borderRadius: '50%' 
            }}></div>
            <span>No Activity</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '2px', 
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        {/* Calendar Headers */}
        <div className="calendar-header">Sun</div>
        <div className="calendar-header">Mon</div>
        <div className="calendar-header">Tue</div>
        <div className="calendar-header">Wed</div>
        <div className="calendar-header">Thu</div>
        <div className="calendar-header">Fri</div>
        <div className="calendar-header">Sat</div>
        <div className="calendar-header">Sun</div>
        
        {/* Calendar Days */}
        {calendarDays}
      </div>
      
      {/* Activity Summary */}
      <div style={{ 
        marginTop: '1rem', 
        padding: '1rem', 
        backgroundColor: 'var(--bg-secondary)', 
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem' }}>📊 Activity Summary for {selectedYear}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {Object.entries(activityData).map(([date, data]) => (
            <div key={date} className="day-summary">
              <div className="summary-date">{formatDateDisplay(date)}</div>
              <div className="summary-details">
                {data.hasSnapshot && <div className="summary-item">📸 Snapshot</div>}
                {data.hasActivity && <div className="summary-item">🔥 Activity ({data.activityCount} events)</div>}
                {!data.hasSnapshot && !data.hasActivity && <div className="summary-item">😴 No Activity</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default YearCalendar;