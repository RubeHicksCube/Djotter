import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell
} from 'recharts';

function DataChart({ type, chartType, data, dataKey, label, fieldType }) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-secondary)'
      }}>
        No data to display
      </div>
    );
  }

  // Transform data for tasks
  let chartData = [];
  if (type === 'tasks') {
    chartData = data.map(group => ({
      date: group.date,
      total: group.stats.total,
      completed: group.stats.completed,
      incomplete: group.stats.incomplete,
      completionRate: (group.stats.completion_rate * 100).toFixed(1)
    }));
  }

  // Transform data for fields
  if (type === 'fields') {
    if (fieldType === 'boolean') {
      chartData = data.map(item => ({
        date: item.date,
        value: item.value !== undefined && item.value !== null ? (item.value ? 1 : 0) : null,
        trueCount: item.trueCount || 0,
        falseCount: item.falseCount || 0,
        totalCount: item.totalCount || 0,
        truePercentage: item.truePercentage !== undefined && item.truePercentage !== null ? parseFloat(item.truePercentage.toFixed(1)) : null
      }));
    } else if (fieldType === 'number' || fieldType === 'currency') {
      chartData = data.map(item => ({
        date: item.date,
        value: item.value !== undefined && item.value !== null ? parseFloat(item.value.toFixed(2)) : null,
        min: item.min !== undefined && item.min !== null ? parseFloat(item.min.toFixed(2)) : null,
        max: item.max !== undefined && item.max !== null ? parseFloat(item.max.toFixed(2)) : null,
        avg: item.avg !== undefined && item.avg !== null ? parseFloat(item.avg.toFixed(2)) : null,
        sum: item.sum !== undefined && item.sum !== null ? parseFloat(item.sum.toFixed(2)) : null,
        count: item.count
      }));
    } else {
      // For text, date, time, datetime - show count and unique count
      chartData = data.map(item => ({
        date: item.date,
        count: item.count || 0,
        uniqueCount: item.uniqueCount || 0,
        mostCommonValue: item.mostCommonValue || '',
        mostCommonCount: item.mostCommonCount || 0
      }));
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '0.75rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: '0.25rem 0', color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1rem'
    }}>
      <ResponsiveContainer width="100%" height={400}>
        {chartType === 'line' ? (
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              style={{ fontSize: '0.875rem' }}
            />
            <YAxis
              stroke="var(--text-secondary)"
              style={{ fontSize: '0.875rem' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {type === 'tasks' && (
              <>
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#7B68EE"
                  strokeWidth={2}
                  name="Total Tasks"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#4CAF50"
                  strokeWidth={2}
                  name="Completed"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="incomplete"
                  stroke="#FF9800"
                  strokeWidth={2}
                  name="Incomplete"
                  dot={{ r: 4 }}
                />
              </>
            )}

            {type === 'fields' && fieldType === 'boolean' && chartData.length > 0 && (
              <>
                <Line
                  type="stepAfter"
                  dataKey="value"
                  stroke="#7B68EE"
                  strokeWidth={3}
                  name="Value (1=true, 0=false)"
                  dot={{ r: 6 }}
                />
                {chartData[0].truePercentage !== undefined && chartData[0].truePercentage !== null && (
                  <Line
                    type="monotone"
                    dataKey="truePercentage"
                    stroke="#4CAF50"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="True %"
                    dot={{ r: 4 }}
                  />
                )}
              </>
            )}

            {type === 'fields' && (fieldType === 'number' || fieldType === 'currency') && chartData.length > 0 && (
              <>
                {chartData[0].value !== undefined && chartData[0].value !== null && (
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#7B68EE"
                    strokeWidth={2}
                    name="Value"
                    dot={{ r: 4 }}
                  />
                )}
                {chartData[0].avg !== undefined && chartData[0].avg !== null && (
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#2196F3"
                    strokeWidth={2}
                    name="Average"
                    dot={{ r: 4 }}
                  />
                )}
                {chartData[0].min !== undefined && chartData[0].min !== null && (
                  <Line
                    type="monotone"
                    dataKey="min"
                    stroke="#FF9800"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Min"
                    dot={{ r: 3 }}
                  />
                )}
                {chartData[0].max !== undefined && chartData[0].max !== null && (
                  <Line
                    type="monotone"
                    dataKey="max"
                    stroke="#4CAF50"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    name="Max"
                    dot={{ r: 3 }}
                  />
                )}
              </>
            )}

            {type === 'fields' && (fieldType === 'text' || fieldType === 'date' || fieldType === 'time' || fieldType === 'datetime') && (
              <>
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#7B68EE"
                  strokeWidth={2}
                  name="Total Entries"
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="uniqueCount"
                  stroke="#4CAF50"
                  strokeWidth={2}
                  name="Unique Values"
                  dot={{ r: 4 }}
                />
              </>
            )}
          </LineChart>
        ) : (
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey="date"
              stroke="var(--text-secondary)"
              style={{ fontSize: '0.875rem' }}
            />
            <YAxis
              stroke="var(--text-secondary)"
              style={{ fontSize: '0.875rem' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {type === 'tasks' && (
              <>
                <Bar dataKey="total" fill="#7B68EE" name="Total Tasks" />
                <Bar dataKey="completed" fill="#4CAF50" name="Completed" />
                <Bar dataKey="incomplete" fill="#FF9800" name="Incomplete" />
              </>
            )}

            {type === 'fields' && fieldType === 'boolean' && (
              <>
                <Bar dataKey="trueCount" fill="#4CAF50" name="True Count" />
                <Bar dataKey="falseCount" fill="#FF9800" name="False Count" />
              </>
            )}

            {type === 'fields' && (fieldType === 'number' || fieldType === 'currency') && chartData.length > 0 && (
              <>
                {chartData[0].value !== undefined && chartData[0].value !== null && (
                  <Bar dataKey="value" fill="#7B68EE" name="Value" />
                )}
                {chartData[0].avg !== undefined && chartData[0].avg !== null && (
                  <Bar dataKey="avg" fill="#2196F3" name="Average" />
                )}
                {chartData[0].sum !== undefined && chartData[0].sum !== null && (
                  <Bar dataKey="sum" fill="#4CAF50" name="Sum" />
                )}
              </>
            )}

            {type === 'fields' && (fieldType === 'text' || fieldType === 'date' || fieldType === 'time' || fieldType === 'datetime') && (
              <>
                <Bar dataKey="count" fill="#7B68EE" name="Total Entries" />
                <Bar dataKey="uniqueCount" fill="#4CAF50" name="Unique Values" />
              </>
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default DataChart;
