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
  let yAxisDomain = ['auto', 'auto'];

  if (type === 'tasks') {
    chartData = data.map(group => ({
      date: group.date,
      total: group.stats.total,
      completed: group.stats.completed,
      incomplete: group.stats.incomplete,
      completionRate: (group.stats.completion_rate * 100).toFixed(1)
    }));
  }

  // Transform data for counters and timers (treat as numeric)
  if (type === 'counters' || type === 'timers') {
    chartData = data.map(item => ({
      date: item.date,
      value: item.value !== undefined && item.value !== null ? parseFloat(item.value.toFixed(2)) : null,
      min: item.min !== undefined && item.min !== null ? parseFloat(item.min.toFixed(2)) : null,
      max: item.max !== undefined && item.max !== null ? parseFloat(item.max.toFixed(2)) : null,
      avg: item.avg !== undefined && item.avg !== null ? parseFloat(item.avg.toFixed(2)) : null,
      sum: item.sum !== undefined && item.sum !== null ? parseFloat(item.sum.toFixed(2)) : null,
      count: item.count
    }));

    // Smart Y-axis scaling for narrow ranges
    const allValues = chartData.flatMap(d => [d.value, d.min, d.max, d.avg].filter(v => v !== null && v !== undefined));
    if (allValues.length > 0) {
      const dataMin = Math.min(...allValues);
      const dataMax = Math.max(...allValues);
      const range = dataMax - dataMin;

      // If range is narrow (less than 20% of the max value), add padding
      if (range < dataMax * 0.2 || range < 10) {
        const padding = Math.max(range * 0.1, 5);
        yAxisDomain = [Math.floor(dataMin - padding), Math.ceil(dataMax + padding)];
      }
    }
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
      yAxisDomain = [0, 'auto'];
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

      // Smart Y-axis scaling for narrow ranges
      const allValues = chartData.flatMap(d => [d.value, d.min, d.max, d.avg].filter(v => v !== null && v !== undefined));
      if (allValues.length > 0) {
        const dataMin = Math.min(...allValues);
        const dataMax = Math.max(...allValues);
        const range = dataMax - dataMin;

        // If range is narrow (less than 20% of the max value), add padding
        if (range < dataMax * 0.2 || range < 10) {
          const padding = Math.max(range * 0.1, 5);
          yAxisDomain = [Math.floor(dataMin - padding), Math.ceil(dataMax + padding)];
        }
      }
    } else if (fieldType === 'time') {
      // Parse time values to minutes since midnight for visualization
      chartData = data.map(item => {
        let timeValue = null;
        if (item.value) {
          const timeParts = item.value.split(':');
          if (timeParts.length >= 2) {
            const hours = parseInt(timeParts[0]);
            const minutes = parseInt(timeParts[1]);
            timeValue = hours * 60 + minutes; // Convert to minutes since midnight
          }
        }
        return {
          date: item.date,
          timeValue,
          timeDisplay: item.value,
          count: item.count || 0,
          uniqueCount: item.uniqueCount || 0
        };
      });
      yAxisDomain = [0, 24 * 60]; // 0 to 1440 minutes (24 hours)
    } else {
      // For text, date, datetime - show count and unique count
      chartData = data.map(item => ({
        date: item.date,
        count: item.count || 0,
        uniqueCount: item.uniqueCount || 0,
        mostCommonValue: item.mostCommonValue || '',
        mostCommonCount: item.mostCommonCount || 0
      }));
      yAxisDomain = [0, 'auto'];
    }
  }

  // Helper function to format minutes to time display
  const formatMinutesToTime = (minutes) => {
    if (minutes === null || minutes === undefined) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

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
          {payload.map((entry, index) => {
            let displayValue = entry.value;
            // Format time values
            if (fieldType === 'time' && entry.dataKey === 'timeValue') {
              displayValue = formatMinutesToTime(entry.value);
            }
            return (
              <p key={index} style={{ margin: '0.25rem 0', color: entry.color }}>
                {entry.name}: {displayValue}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // For bar charts with numeric/currency fields or trackers, create summary data instead of daily data
  let barChartData = chartData;
  if (chartType === 'bar' && (
    (type === 'fields' && (fieldType === 'number' || fieldType === 'currency')) ||
    type === 'counters' ||
    type === 'timers'
  ) && chartData.length > 0) {
    // Calculate overall statistics across all dates
    const allValues = chartData.map(d => d.value).filter(v => v !== null && v !== undefined);
    const allAvgs = chartData.map(d => d.avg).filter(v => v !== null && v !== undefined);
    const allSums = chartData.map(d => d.sum).filter(v => v !== null && v !== undefined);
    const allMins = chartData.map(d => d.min).filter(v => v !== null && v !== undefined);
    const allMaxs = chartData.map(d => d.max).filter(v => v !== null && v !== undefined);

    barChartData = [];

    if (allValues.length > 0) {
      const overallValue = allValues.reduce((sum, v) => sum + v, 0) / allValues.length;
      barChartData.push({ metric: 'Overall Value', value: parseFloat(overallValue.toFixed(2)) });
    }

    if (allAvgs.length > 0) {
      const overallAvg = allAvgs.reduce((sum, v) => sum + v, 0) / allAvgs.length;
      barChartData.push({ metric: 'Average', value: parseFloat(overallAvg.toFixed(2)) });
    }

    if (allSums.length > 0) {
      const overallSum = allSums.reduce((sum, v) => sum + v, 0);
      barChartData.push({ metric: 'Total Sum', value: parseFloat(overallSum.toFixed(2)) });
    }

    if (allMins.length > 0) {
      const overallMin = Math.min(...allMins);
      barChartData.push({ metric: 'Minimum', value: parseFloat(overallMin.toFixed(2)) });
    }

    if (allMaxs.length > 0) {
      const overallMax = Math.max(...allMaxs);
      barChartData.push({ metric: 'Maximum', value: parseFloat(overallMax.toFixed(2)) });
    }
  }

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
              domain={yAxisDomain}
              tickFormatter={fieldType === 'time' ? formatMinutesToTime : undefined}
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
                  type="monotone"
                  dataKey="trueCount"
                  stroke="#4CAF50"
                  strokeWidth={3}
                  name="True (Checked)"
                  dot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="falseCount"
                  stroke="#FF9800"
                  strokeWidth={3}
                  name="False (Unchecked)"
                  dot={{ r: 5 }}
                />
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

            {type === 'fields' && fieldType === 'time' && (
              <>
                <Line
                  type="monotone"
                  dataKey="timeValue"
                  stroke="#7B68EE"
                  strokeWidth={3}
                  name="Time"
                  dot={{ r: 5 }}
                />
              </>
            )}

            {type === 'fields' && (fieldType === 'text' || fieldType === 'date' || fieldType === 'datetime') && (
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

            {(type === 'counters' || type === 'timers') && chartData.length > 0 && (
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
          </LineChart>
        ) : (
          <BarChart data={barChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis
              dataKey={(type === 'fields' && (fieldType === 'number' || fieldType === 'currency')) || type === 'counters' || type === 'timers' ? 'metric' : 'date'}
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

            {type === 'fields' && (fieldType === 'number' || fieldType === 'currency') && barChartData.length > 0 && (
              <Bar dataKey="value" fill="#7B68EE" name="Value">
                {barChartData.map((entry, index) => {
                  const colors = ['#7B68EE', '#2196F3', '#4CAF50', '#FF9800', '#E91E63'];
                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                })}
              </Bar>
            )}

            {type === 'fields' && (fieldType === 'text' || fieldType === 'date' || fieldType === 'time' || fieldType === 'datetime') && (
              <>
                <Bar dataKey="count" fill="#7B68EE" name="Total Entries" />
                <Bar dataKey="uniqueCount" fill="#4CAF50" name="Unique Values" />
              </>
            )}

            {(type === 'counters' || type === 'timers') && barChartData.length > 0 && (
              <Bar dataKey="value" fill="#7B68EE" name="Value">
                {barChartData.map((entry, index) => {
                  const colors = ['#7B68EE', '#2196F3', '#4CAF50', '#FF9800', '#E91E63'];
                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                })}
              </Bar>
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default DataChart;
