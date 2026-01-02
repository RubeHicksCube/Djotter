import React, { useState } from 'react';

function TaskQueryBuilder({ onRunQuery, isLoading }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [completionStatus, setCompletionStatus] = useState('all');
  const [groupBy, setGroupBy] = useState('day');

  const handleRunQuery = (e) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      alert('End date must be after start date');
      return;
    }

    const daysDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      alert('Date range cannot exceed 1 year');
      return;
    }

    onRunQuery({
      startDate,
      endDate,
      completionStatus,
      groupBy
    });
  };

  return (
    <form onSubmit={handleRunQuery} style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1.5rem',
      marginBottom: '1rem'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>
        Task Query Builder
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {/* Start Date */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem'
            }}
            required
          />
        </div>

        {/* End Date */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem'
            }}
            required
          />
        </div>

        {/* Completion Status */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Status Filter
          </label>
          <select
            value={completionStatus}
            onChange={(e) => setCompletionStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem'
            }}
          >
            <option value="all">All Tasks</option>
            <option value="completed">Completed Only</option>
            <option value="incomplete">Incomplete Only</option>
          </select>
        </div>

        {/* Group By */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Group By
          </label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem'
            }}
          >
            <option value="none">No Grouping</option>
            <option value="day">By Day</option>
            <option value="week">By Week</option>
            <option value="month">By Month</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 2rem',
          backgroundColor: isLoading ? 'var(--text-secondary)' : 'var(--primary-color)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          fontWeight: '500',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => !isLoading && (e.target.style.opacity = '0.9')}
        onMouseOut={(e) => !isLoading && (e.target.style.opacity = '1')}
      >
        {isLoading ? 'Running Query...' : 'Run Query'}
      </button>
    </form>
  );
}

export default TaskQueryBuilder;
