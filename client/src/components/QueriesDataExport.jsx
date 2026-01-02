import React, { useState, useEffect } from 'react';
import DataChart from './DataChart';
import StatisticsTable from './StatisticsTable';
import ContributionCalendar from './ContributionCalendar';

function QueriesDataExport({
  queryTasks,
  queryFields,
  exportCSV,
  getCustomFieldTemplates,
  // Snapshot props
  availableDates,
  handleSaveSnapshot,
  handleDeleteSnapshot,
  retentionSettings,
  setRetentionSettings,
  handleUpdateRetentionSettings,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  handleDownloadRange,
  handleDownloadRangePDF,
  formatDateDisplay
}) {
  const [queryType, setQueryType] = useState('tasks');
  const [selectedField, setSelectedField] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [completionStatus, setCompletionStatus] = useState('all');
  const [groupBy, setGroupBy] = useState('day');
  const [numericFields, setNumericFields] = useState([]);

  const [queryData, setQueryData] = useState(null);
  const [queryParams, setQueryParams] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [chartType, setChartType] = useState('line');
  const [viewMode, setViewMode] = useState('chart');
  const [showCalendar, setShowCalendar] = useState(false);
  const [shouldAutoSubmit, setShouldAutoSubmit] = useState(false);

  // Modal state for snapshot multi-select
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [selectedSnapshots, setSelectedSnapshots] = useState([]);
  const [zipFileType, setZipFileType] = useState('markdown'); // 'markdown', 'pdf', or 'both'
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [dateRangeSet, setDateRangeSet] = useState(false);

  useEffect(() => {
    // Fetch custom field templates on mount
    const fetchTemplates = async () => {
      try {
        const templates = await getCustomFieldTemplates();
        const numeric = templates.filter(t => t.field_type === 'number' || t.field_type === 'currency');
        setNumericFields(numeric);
        if (numeric.length > 0 && !selectedField && selectedFields.length === 0) {
          setSelectedField(numeric[0].key);
        }
      } catch (error) {
        console.error('Error fetching templates:', error);
      }
    };

    fetchTemplates();
  }, [getCustomFieldTemplates]);

  // Modal body handling with pointer events control
  useEffect(() => {
    if (showSnapshotModal) {
      document.body.style.overflow = 'hidden';
      // Disable pointer events on main content when modal is open
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.style.pointerEvents = 'none';
      }
    } else {
      document.body.style.overflow = '';
      // Re-enable pointer events
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.style.pointerEvents = '';
      }
    }
  }, [showSnapshotModal]);

  // Watch for auto-submit after date changes (mirroring Home page functionality)
  useEffect(() => {
    if (shouldAutoSubmit && startDate && endDate) {
      setShouldAutoSubmit(false);
      setTimeout(() => {
        handleRunQuery({ preventDefault: () => {} });
      }, 50);
    }
  }, [startDate, endDate, shouldAutoSubmit]);

  // Handle calendar date click
  const handleCalendarDateClick = (dateStr) => {
    setStartDate(dateStr);
    setEndDate(dateStr);
    setQueryType('snapshots'); // Switch to snapshots mode
    setShouldAutoSubmit(true); // Trigger auto-submit
    setShowCalendar(false); // Hide calendar after selection
  };

  const handleRunQuery = async (e) => {
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

    // Date range limits based on query type and grouping
    if (queryType === 'tasks') {
      // Tasks limited to 1 year
      if (daysDiff > 365) {
        alert('Date range for tasks cannot exceed 1 year (365 days)');
        return;
      }
    } else if (queryType === 'fields') {
      // Fields have different limits based on grouping
      if (groupBy === 'day' && daysDiff > 365) {
        alert('Date range for daily grouping cannot exceed 1 year (365 days)');
        return;
      } else if (groupBy === 'week' && daysDiff > 364) {
        alert('Date range for weekly grouping cannot exceed 52 weeks (364 days)');
        return;
      }
      // Monthly and yearly grouping: no limit
    }

    if (queryType === 'fields' && !selectedField && selectedFields.length === 0) {
      alert('Please select at least one numeric field');
      return;
    }

    setIsLoading(true);
    try {
      let result;
      let params;

      if (queryType === 'tasks') {
        params = { startDate, endDate, completionStatus, groupBy };
        result = await queryTasks(params);
      } else if (queryType === 'fields') {
        // Support both single and multi-field queries
        const fieldKeys = selectedFields.length > 0 ? selectedFields : [selectedField];
        params = { fieldKeys, startDate, endDate, groupBy };
        result = await queryFields(params);
      }

      setQueryData(result);
      setQueryParams(params);
    } catch (error) {
      console.error('Error running query:', error);
      alert('Failed to run query. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (queryType === 'snapshots') return;

    setIsExporting(true);
    try {
      await exportCSV(queryType, queryParams);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      alert('Failed to export to CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZip = async () => {
    if (selectedSnapshots.length === 0) {
      alert('Please select at least one snapshot');
      return;
    }

    setIsDownloadingZip(true);
    try {
      const token = localStorage.getItem('authToken');

      const response = await fetch('/api/exports/download-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dates: selectedSnapshots,
          fileType: zipFileType,
          token
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to download zip file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshots_${selectedSnapshots.length}_files.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowSnapshotModal(false);
      setSelectedSnapshots([]);
    } catch (error) {
      console.error('Error downloading zip:', error);
      alert(`Failed to download zip file: ${error.message}`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Handle both single field and multi-field responses
  const isMultiField = queryData && queryData.fields && Array.isArray(queryData.fields);
  const hasCombinedData = queryData && queryData.combined && queryData.combined.data && queryData.combined.data.length > 0;
  const hasData = queryData && (
    (queryData.data && queryData.data.length > 0) ||
    hasCombinedData
  );

  // Calculate summary counts
  const snapshotCount = availableDates ? availableDates.length : 0;
  const taskCount = queryData && queryType === 'tasks' && queryData.summary ? queryData.summary.total : 0;
  const fieldCount = queryData && queryType === 'fields' ? (
    hasCombinedData
      ? queryData.combined.summary.field_count
      : (queryData.summary && queryData.summary.total_count) || 0
  ) : 0;

  // Filter available dates based on search
  const filteredDates = availableDates ? availableDates.filter(date => {
    if (!searchFilter) return true;
    const formattedDate = formatDateDisplay(date);
    return date.includes(searchFilter) || formattedDate.toLowerCase().includes(searchFilter.toLowerCase());
  }) : [];

  // Handle select button click with visual feedback
  const handleSelectDate = (date) => {
    setStartDate(date);
    setEndDate(date);
    setDateRangeSet(true);
    setTimeout(() => setDateRangeSet(false), 2000); // Clear feedback after 2 seconds
  };



  return (
    <div>
      <h2>📊 Queries & Data Export</h2>
      <p className="card-description">Query tasks and fields with analytics, or manage daily snapshots</p>

      {/* Calendar Toggle for Snapshots */}
      {queryType === 'snapshots' && availableDates && availableDates.length > 0 && (
        <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              className={`btn btn-sm ${showCalendar ? 'btn-primary' : 'btn-ghost'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              📅 Calendar {showCalendar ? '▲' : '▼'}
            </button>
            {showCalendar && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {availableDates.length} days with data
              </span>
            )}
          </div>
          
          {/* Expanding Calendar Section */}
          {showCalendar && (
            <div style={{ 
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              transition: 'all 0.3s ease'
            }}>
              <ContributionCalendar 
                availableDates={availableDates}
                formatDateDisplay={formatDateDisplay}
                compact={true}
                onDateClick={handleCalendarDateClick}
              />
            </div>
          )}
        </div>
      )}

      {/* Unified Query Form */}
      <form onSubmit={handleRunQuery} className="export-section">
        {/* Type Selector */}
        <div className="form-group">
          <label>Query Type</label>
          <select
            className="form-input"
            value={queryType}
            onChange={(e) => {
              setQueryType(e.target.value);
              setQueryData(null); // Clear previous results
            }}
          >
            <option value="tasks">Tasks</option>
            <option value="fields">Fields</option>
            <option value="snapshots">Snapshots</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="date-range-form">
          <div className="form-group">
            <label>Start Date {dateRangeSet && <span style={{ color: 'var(--success-color)', marginLeft: '0.5rem' }}>✓ Updated</span>}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {setStartDate(e.target.value); setDateRangeSet(false);}}
              required={queryType !== 'snapshots'}
              style={dateRangeSet ? { borderColor: 'var(--success-color)', borderWidth: '2px' } : {}}
            />
          </div>
          <div className="form-group">
            <label>End Date {dateRangeSet && <span style={{ color: 'var(--success-color)', marginLeft: '0.5rem' }}>✓ Updated</span>}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {setEndDate(e.target.value); setDateRangeSet(false);}}
              required={queryType !== 'snapshots'}
              style={dateRangeSet ? { borderColor: 'var(--success-color)', borderWidth: '2px' } : {}}
            />
          </div>
        </div>

        {/* Type-specific filters */}
        {queryType === 'tasks' && (
          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>Status Filter</label>
              <select
                className="form-input"
                value={completionStatus}
                onChange={(e) => setCompletionStatus(e.target.value)}
              >
                <option value="all">All Tasks</option>
                <option value="completed">Completed Only</option>
                <option value="incomplete">Incomplete Only</option>
              </select>
            </div>
            <div className="form-group">
              <label>Group By</label>
              <select
                className="form-input"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="none">No Grouping</option>
                <option value="day">By Day</option>
                <option value="week">By Week</option>
                <option value="month">By Month</option>
                <option value="year">By Year</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                ⏱️ Task queries limited to 1 year (365 days)
              </p>
            </div>
          </div>
        )}

        {queryType === 'fields' && (
          <>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Select Fields to Compare (select multiple for combined export)
              </label>
              <div style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {numericFields.map(field => (
                  <label key={field.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFields([...selectedFields, field.key]);
                        } else {
                          setSelectedFields(selectedFields.filter(k => k !== field.key));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{field.key} ({field.field_type})</span>
                  </label>
                ))}
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {selectedFields.length === 0 ? 'No fields selected' :
                 selectedFields.length === 1 ? '1 field selected' :
                 `${selectedFields.length} fields selected`}
              </p>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Group By</label>
              <select
                className="form-input"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="day">By Day (max 365 days)</option>
                <option value="week">By Week (max 52 weeks)</option>
                <option value="month">By Month (unlimited)</option>
                <option value="year">By Year (unlimited)</option>
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {groupBy === 'day' && '⏱️ Daily view limited to 1 year for performance'}
                {groupBy === 'week' && '⏱️ Weekly view limited to 52 weeks for performance'}
                {groupBy === 'month' && '✨ No date range limit - perfect for long-term tracking'}
                {groupBy === 'year' && '✨ No date range limit - ideal for multi-year analysis'}
              </p>
            </div>
          </>
        )}

        {queryType === 'fields' && numericFields.length === 0 && (
          <div className="empty-state" style={{ marginTop: '1rem' }}>
            No numeric fields found. Create a numeric template field on the Home page first.
          </div>
        )}

        {/* Action Buttons */}
        {queryType === 'snapshots' ? (
          <div style={{ marginTop: '1rem' }}>
            {/* Save Today's Snapshot - Full Width */}
            <button
              onClick={handleSaveSnapshot}
              type="button"
              className="btn btn-success"
              style={{ width: '100%', marginBottom: '1rem' }}
            >
              💾 Save Today's Snapshot
            </button>

            {/* Download Buttons Row */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button onClick={handleDownloadRange} type="button" className="btn btn-success">
                📥 Download Markdown
              </button>
              <button onClick={handleDownloadRangePDF} type="button" className="btn btn-success">
                📄 Download PDF
              </button>
            </div>

            {/* Retention Settings */}
            <div className="retention-inline">
              <label>Keep last</label>
              <input
                type="number"
                min="0"
                value={retentionSettings.maxCount}
                onChange={(e) => setRetentionSettings(prev => ({
                  ...prev,
                  maxCount: parseInt(e.target.value) || 0
                }))}
                onBlur={handleUpdateRetentionSettings}
                className="retention-input"
                placeholder="100"
              />
              <label>snapshots</label>
              <small className="retention-hint">(0 = keep all)</small>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <button type="submit" disabled={isLoading} className="btn btn-primary">
              {isLoading ? 'Running Query...' : '🔍 Run Query'}
            </button>
          </div>
        )}
      </form>

      {/* Query Results */}
      {queryType !== 'snapshots' && queryData && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* Controls */}
          <div className="export-section">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontWeight: '500' }}>View:</label>
                <button
                  onClick={() => setViewMode('chart')}
                  className={viewMode === 'chart' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                  type="button"
                >
                  Chart
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={viewMode === 'table' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                  type="button"
                >
                  Raw Data
                </button>
              </div>

              {viewMode === 'chart' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontWeight: '500' }}>Chart:</label>
                  <button
                    onClick={() => setChartType('line')}
                    className={chartType === 'line' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                    type="button"
                  >
                    Line
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={chartType === 'bar' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                    type="button"
                  >
                    Bar
                  </button>
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={isExporting || !hasData}
                className="btn btn-success"
                type="button"
              >
                {isExporting ? 'Exporting...' : '📥 Download CSV'}
              </button>
            </div>
          </div>

          {/* Data Display */}
          {!hasData ? (
            <div className="empty-state">
              No data found for the selected criteria. Try adjusting your query parameters.
            </div>
          ) : (
            <>
              {hasCombinedData ? (
                // Multi-field combined display
                <>
                  <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>
                      Combined Analysis: {queryData.fieldKeys.join(', ')}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Showing sum of all {queryData.combined.summary.field_count} fields over time
                    </p>
                  </div>

                  {viewMode === 'chart' ? (
                    <>
                      <DataChart
                        type={queryType}
                        chartType={chartType}
                        data={queryData.combined.data}
                      />
                      <StatisticsTable type={queryType} summary={queryData.combined.summary} />
                    </>
                  ) : (
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      marginTop: '1rem',
                      maxHeight: '500px',
                      overflowY: 'auto'
                    }}>
                      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>
                        Combined Raw Data
                      </h3>
                      <pre style={{
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {JSON.stringify(queryData.combined, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                // Single field display (original)
                <>
                  {viewMode === 'chart' ? (
                    <DataChart
                      type={queryType}
                      chartType={chartType}
                      data={queryData.data}
                    />
                  ) : (
                    <div style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '1.5rem',
                      marginTop: '1rem',
                      maxHeight: '500px',
                      overflowY: 'auto'
                    }}>
                      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>
                        Raw Data
                      </h3>
                      <pre style={{
                        fontSize: '0.75rem',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {JSON.stringify(queryData.data, null, 2)}
                      </pre>
                    </div>
                  )}

                  <StatisticsTable type={queryType} summary={queryData.summary} />
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Saved Snapshots List */}
      {queryType === 'snapshots' && availableDates && availableDates.length > 0 && (
        <div className="available-dates">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Saved Snapshots ({snapshotCount})</h3>
            {availableDates.length > 3 && (
              <button
                onClick={() => setShowSnapshotModal(true)}
                className="btn btn-sm btn-primary"
                type="button"
              >
                📋 View All Snapshots
              </button>
            )}
          </div>
          
          {/* Calendar View */}
          <div className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>📅 Contribution Calendar</h4>
            <ContributionCalendar 
              availableDates={availableDates}
              formatDateDisplay={formatDateDisplay}
            />
          </div>
          
          {/* List View */}
          <div className="dates-list" style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>📋 List View (Last 3)</h4>
            {availableDates.slice(0, 3).map(date => (
              <div key={date} className="date-item">
                <span className="date-badge">📅 {formatDateDisplay(date)}</span>
                <div className="date-actions">
                  <button
                    onClick={() => handleSelectDate(date)}
                    className="btn btn-sm btn-success"
                    title="Select this date"
                    type="button"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => handleDeleteSnapshot(date)}
                    className="btn-icon btn-icon-sm btn-danger"
                    title="Delete snapshot"
                    type="button"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
          {availableDates.length > 3 && (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: 'center' }}>
              Showing last 3 snapshots in list view. Calendar shows all {snapshotCount} snapshots.
            </p>
          )}
        </div>
      )}

      {queryType === 'snapshots' && availableDates && availableDates.length === 0 && (
        <div className="empty-state">
          No saved snapshots yet. Click "Save Today's Snapshot" to start building your export history.
        </div>
      )}

      {/* Summary Counts */}
      {queryType !== 'snapshots' && queryData && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <strong>
            {queryType === 'tasks' && `Total: ${taskCount} tasks`}
            {queryType === 'fields' && `Total: ${fieldCount} values`}
          </strong>
        </div>
      )}

      {/* Snapshot Selection Modal */}
      {showSnapshotModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)', // Darker backdrop to hide underlying animations
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            cursor: 'pointer'
          }}
          onClick={() => setShowSnapshotModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              width: 'min(90vw, 900px)',
              height: 'min(85vh, 750px)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-color)',
              overflowY: 'auto', // Allow scrolling if content is tall
              padding: '1.5rem' // More padding for better spacing
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0 }}>All Saved Snapshots ({snapshotCount})</h3>
              <button
                onClick={() => setShowSnapshotModal(false)}
                className="btn-icon"
                style={{ fontSize: '1.5rem' }}
                type="button"
              >
                ✖
              </button>
            </div>

            {/* Search and Selection Info */}
            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              {/* Search Input */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  placeholder="🔍 Search by date (e.g., 2025-01 or January)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              {/* Selection Info */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong>{selectedSnapshots.length}</strong> snapshot{selectedSnapshots.length !== 1 ? 's' : ''} selected
                  {searchFilter && <span style={{ marginLeft: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    ({filteredDates.length} of {availableDates.length} shown)
                  </span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setSelectedSnapshots(filteredDates)}
                    className="btn btn-sm btn-ghost"
                    type="button"
                  >
                    Select All {searchFilter && 'Filtered'}
                  </button>
                  <button
                    onClick={() => setSelectedSnapshots([])}
                    className="btn btn-sm btn-ghost"
                    type="button"
                    disabled={selectedSnapshots.length === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem 1.5rem'
            }}>
              {filteredDates.length === 0 && searchFilter ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  No snapshots found matching "{searchFilter}"
                </div>
              ) : (
                filteredDates.slice().reverse().map(date => (
                <label
                  key={date}
                  className="snapshot-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: selectedSnapshots.includes(date) ? 'var(--primary-light)' : 'var(--bg-secondary)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedSnapshots.includes(date)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSnapshots([...selectedSnapshots, date]);
                      } else {
                        setSelectedSnapshots(selectedSnapshots.filter(d => d !== date));
                      }
                    }}
                    style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                  />
                  <span style={{ flex: 1 }}>📅 {formatDateDisplay(date)}</span>
                </label>
              )))}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '1.5rem',
              borderTop: '1px solid var(--border-color)'
            }}>
              {/* File Type Selector */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  File Type:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setZipFileType('markdown')}
                    className={zipFileType === 'markdown' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                    type="button"
                  >
                    📝 Markdown
                  </button>
                  <button
                    onClick={() => setZipFileType('pdf')}
                    className={zipFileType === 'pdf' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                    type="button"
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => setZipFileType('both')}
                    className={zipFileType === 'both' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                    type="button"
                  >
                    📦 Both
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowSnapshotModal(false);
                    setSelectedSnapshots([]);
                  }}
                  className="btn btn-ghost"
                  type="button"
                  disabled={isDownloadingZip}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadZip}
                  className="btn btn-success"
                  type="button"
                  disabled={selectedSnapshots.length === 0 || isDownloadingZip}
                >
                  {isDownloadingZip
                    ? 'Preparing...'
                    : `📥 Download Zip ${selectedSnapshots.length > 0 ? `(${selectedSnapshots.length})` : ''}`
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default QueriesDataExport;
