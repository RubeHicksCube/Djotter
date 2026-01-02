import React, { useState } from 'react';
import DataChart from './DataChart';
import StatisticsTable from './StatisticsTable';

function QueryResults({ type, queryData, queryParams, onExportExcel, isExporting }) {
  const [chartType, setChartType] = useState('line');
  const [viewMode, setViewMode] = useState('chart'); // 'chart' or 'table'

  if (!queryData) {
    return null;
  }

  const hasData = queryData.data && queryData.data.length > 0;

  const handleExport = async () => {
    try {
      await onExportExcel(type, queryParams);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    }
  };

  return (
    <div>
      {/* Controls */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Chart Type Selector */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontWeight: '500', marginRight: '0.5rem' }}>View:</label>
          <button
            onClick={() => setViewMode('chart')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: viewMode === 'chart' ? 'var(--primary-color)' : 'var(--bg-primary)',
              color: viewMode === 'chart' ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: viewMode === 'table' ? 'var(--primary-color)' : 'var(--bg-primary)',
              color: viewMode === 'table' ? 'white' : 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            Raw Data
          </button>
        </div>

        {viewMode === 'chart' && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontWeight: '500', marginRight: '0.5rem' }}>Chart Type:</label>
            <button
              onClick={() => setChartType('line')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: chartType === 'line' ? 'var(--primary-color)' : 'var(--bg-primary)',
                color: chartType === 'line' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Line
            </button>
            <button
              onClick={() => setChartType('bar')}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: chartType === 'bar' ? 'var(--primary-color)' : 'var(--bg-primary)',
                color: chartType === 'bar' ? 'white' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              Bar
            </button>
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={isExporting || !hasData}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: isExporting || !hasData ? 'var(--text-secondary)' : 'var(--success-color)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isExporting || !hasData ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => !isExporting && hasData && (e.target.style.opacity = '0.9')}
          onMouseOut={(e) => !isExporting && hasData && (e.target.style.opacity = '1')}
        >
          {isExporting ? 'Exporting...' : 'Download Excel'}
        </button>
      </div>

      {/* Data Display */}
      {!hasData ? (
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          No data found for the selected criteria. Try adjusting your query parameters.
        </div>
      ) : (
        <>
          {viewMode === 'chart' ? (
            <DataChart
              type={type}
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

          <StatisticsTable type={type} summary={queryData.summary} />
        </>
      )}
    </div>
  );
}

export default QueryResults;
