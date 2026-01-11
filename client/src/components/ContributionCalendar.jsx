import React, { useState } from 'react';
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay, subYears, addYears, parseISO, isWithinInterval } from 'date-fns';

function ContributionCalendar({ availableDates, formatDateDisplay, compact = false, onDateClick, enableRangeSelection = false, onRangeSelect }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);

  // Handle date click for range selection
  const handleDateClickInternal = (dateStr) => {
    if (enableRangeSelection) {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        // Start new range selection
        setRangeStart(dateStr);
        setRangeEnd(null);
        setIsSelectingRange(true);
      } else {
        // Complete range selection
        const start = new Date(rangeStart);
        const end = new Date(dateStr);

        if (end < start) {
          // Swap if end is before start
          setRangeStart(dateStr);
          setRangeEnd(rangeStart);
          if (onRangeSelect) {
            onRangeSelect(dateStr, rangeStart);
          }
        } else {
          setRangeEnd(dateStr);
          if (onRangeSelect) {
            onRangeSelect(rangeStart, dateStr);
          }
        }
        setIsSelectingRange(false);
      }
    } else if (onDateClick) {
      onDateClick(dateStr);
    }
  };

  // Check if a date is within the selected range
  const isInRange = (dateStr) => {
    if (!rangeStart || !rangeEnd) return false;
    const date = parseISO(dateStr);
    const start = parseISO(rangeStart);
    const end = parseISO(rangeEnd);
    return isWithinInterval(date, { start, end });
  };

  // Get activity level for a given date (0-4 scale like GitHub)
  const getActivityLevel = (dateStr) => {
    if (availableDates.includes(dateStr)) {
      // For now, simple binary - has snapshot or not
      // Could be enhanced to show activity intensity
      return 3; // Medium green for snapshots
    }
    return 0; // No activity
  };

  const getActivityColor = (level) => {
    const colors = [
      'var(--bg-primary)',      // Level 0 - no activity
      'var(--success-secondary)', // Level 1 - light green  
      'var(--success-primary)',  // Level 2 - medium green
      'var(--success-dark)',     // Level 3 - dark green
      'var(--success-darkest)'   // Level 4 - darkest green
    ];
    return colors[level] || colors[0];
  };

  // Generate GitHub-style contribution graph
  const generateContributionGraph = () => {
    const year = selectedYear;
    const startDate = startOfYear(new Date(year, 0, 1));
    const endDate = endOfYear(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Group days by week
    const weeks = [];
    let currentWeek = [];

    // Add empty cells for days before Jan 1st to align with Sunday
    const firstDayOfYear = getDay(startDate);
    for (let i = 0; i < firstDayOfYear; i++) {
      currentWeek.push(null);
    }

    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      currentWeek.push({
        date: day,
        dateStr,
        activityLevel: getActivityLevel(dateStr)
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    // Add remaining days of the last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const weeks = generateContributionGraph();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Generate year options for dropdown (last 5 years and next 2 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = 5; i >= 0; i--) {
    yearOptions.push(currentYear - i);
  }
  for (let i = 1; i <= 2; i++) {
    yearOptions.push(currentYear + i);
  }

  const calendarStyle = compact ? {
    fontFamily: 'monospace',
    fontSize: '0.6rem'
  } : {
    fontFamily: 'monospace', 
    fontSize: '0.75rem'
  };

  const squareSize = compact ? '0.7rem' : '1rem';
  const squareGap = compact ? '1px' : '2px';

  return (
    <div className="contribution-calendar" style={calendarStyle}>
      {/* Year Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? '0.5rem' : '1rem' }}>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="form-input"
          style={{ width: 'auto', padding: compact ? '0.15rem 0.3rem' : '0.25rem 0.5rem' }}
        >
          {yearOptions.map(year => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <h4 style={{ margin: 0, fontSize: compact ? '0.8rem' : '1rem' }}>
          {availableDates.filter(date => date.startsWith(selectedYear.toString())).length} contributions
        </h4>
      </div>

      {/* Range Selection Info */}
      {enableRangeSelection && (rangeStart || rangeEnd) && (
        <div style={{
          marginBottom: compact ? '0.5rem' : '1rem',
          padding: compact ? '0.3rem' : '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: compact ? '0.6rem' : '0.75rem'
        }}>
          <div>
            {rangeStart && !rangeEnd && (
              <span>Click to select end date (Start: {rangeStart})</span>
            )}
            {rangeStart && rangeEnd && (
              <span>Selected range: {rangeStart} to {rangeEnd}</span>
            )}
          </div>
          <button
            onClick={() => {
              setRangeStart(null);
              setRangeEnd(null);
              setIsSelectingRange(false);
              if (onRangeSelect) {
                onRangeSelect(null, null);
              }
            }}
            className="btn btn-secondary"
            style={{
              padding: compact ? '0.15rem 0.3rem' : '0.25rem 0.5rem',
              fontSize: compact ? '0.6rem' : '0.75rem'
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {/* Weekday labels */}
        <div style={{ display: 'flex', flexDirection: 'column', marginRight: compact ? '0.3rem' : '0.5rem' }}>
          {weekdays.map((day, index) => (
            <div 
              key={day} 
              style={{ 
                height: squareSize, 
                width: compact ? '1.5rem' : '2rem', 
                display: 'flex', 
                alignItems: 'center',
                fontSize: compact ? '0.5rem' : '0.6rem',
                color: 'var(--text-secondary)',
                opacity: index % 2 === 0 ? 1 : 0.5 // Only show every other day like GitHub
              }}
            >
              {index % 2 === 0 ? day : ''}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{ display: 'flex', gap: squareGap }}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: squareGap }}>
              {week.map((day, dayIndex) => {
                if (!day) {
                  return (
                    <div
                      key={`empty-${weekIndex}-${dayIndex}`}
                      style={{ 
                        width: squareSize, 
                        height: squareSize,
                        borderRadius: '2px'
                      }}
                    />
                  );
                }

                const isStartDate = enableRangeSelection && day.dateStr === rangeStart;
                const isEndDate = enableRangeSelection && day.dateStr === rangeEnd;
                const inRange = enableRangeSelection && isInRange(day.dateStr);

                return (
                  <div
                    key={day.dateStr}
                    style={{
                      width: squareSize,
                      height: squareSize,
                      borderRadius: '2px',
                      backgroundColor: isStartDate || isEndDate
                        ? 'var(--primary-color)'
                        : inRange
                          ? 'rgba(59, 130, 246, 0.3)'
                          : getActivityColor(day.activityLevel),
                      border: isStartDate || isEndDate
                        ? '2px solid var(--primary-dark)'
                        : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                    title={
                      enableRangeSelection
                        ? isStartDate
                          ? `Start: ${day.dateStr}`
                          : isEndDate
                            ? `End: ${day.dateStr}`
                            : `${day.dateStr}${day.activityLevel > 0 ? ' - has snapshot' : ''}`
                        : `${day.dateStr}${day.activityLevel > 0 ? ' - has snapshot' : ' - click to filter'}`
                    }
                    onMouseEnter={(e) => {
                      if (!isStartDate && !isEndDate) {
                        e.target.style.transform = 'scale(1.2)';
                        e.target.style.borderColor = 'var(--primary-color)';
                        if (day.activityLevel === 0 && !inRange) {
                          e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isStartDate && !isEndDate) {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.backgroundColor = inRange
                          ? 'rgba(59, 130, 246, 0.3)'
                          : getActivityColor(day.activityLevel);
                      }
                    }}
                    onClick={() => handleDateClickInternal(day.dateStr)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-end',
        marginTop: compact ? '0.25rem' : '0.5rem',
        fontSize: compact ? '0.5rem' : '0.6rem',
        color: 'var(--text-secondary)'
      }}>
        <span style={{ marginRight: compact ? '0.3rem' : '0.5rem' }}>Less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <div
            key={level}
            style={{
              width: squareSize,
              height: squareSize,
              borderRadius: '2px',
              backgroundColor: getActivityColor(level),
              border: '1px solid var(--border-color)',
              marginLeft: compact ? '1px' : '2px'
            }}
          />
        ))}
        <span style={{ marginLeft: compact ? '0.3rem' : '0.5rem' }}>More</span>
      </div>
    </div>
  );
}

export default ContributionCalendar;