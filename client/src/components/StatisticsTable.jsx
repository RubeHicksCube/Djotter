import React from 'react';

function StatisticsTable({ type, summary }) {
  if (!summary) return null;

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '1.5rem',
      marginTop: '1rem'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--primary-color)' }}>
        Summary Statistics
      </h3>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse'
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
            <th style={{
              textAlign: 'left',
              padding: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              Metric
            </th>
            <th style={{
              textAlign: 'right',
              padding: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {type === 'tasks' && (
            <>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Total Tasks</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.total}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Completed Tasks</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success-color)' }}>
                  {summary.completed}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Incomplete Tasks</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                  {summary.incomplete}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Completion Rate</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  {(summary.completion_rate * 100).toFixed(1)}%
                </td>
              </tr>
              {summary.avg_time_to_complete_minutes !== null && (
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem' }}>Avg Time to Complete</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                    {summary.avg_time_to_complete_minutes.toFixed(0)} min
                  </td>
                </tr>
              )}
            </>
          )}

          {type === 'fields' && summary.trend === 'boolean' && (
            <>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Total True Count</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success-color)' }}>
                  {summary.overall_true_count || 0}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Total False Count</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--error-color)' }}>
                  {summary.overall_false_count || 0}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>True Percentage</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  {summary.overall_true_percentage !== undefined && summary.overall_true_percentage !== null ? summary.overall_true_percentage.toFixed(1) : '0.0'}%
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem' }}>Total Data Points</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.total_count || 0}
                </td>
              </tr>
            </>
          )}

          {type === 'fields' && summary.trend === 'categorical' && (
            <>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Total Entries</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.total_count || 0}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Unique Values</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  {summary.unique_count || 0}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>Most Common Value</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success-color)' }}>
                  {summary.most_common_value || 'N/A'}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem' }}>Most Common Count</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.most_common_count || 0}
                </td>
              </tr>
            </>
          )}

          {type === 'fields' && summary.trend !== 'boolean' && summary.trend !== 'categorical' && (
            <>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Sum (Total) {summary.field_count > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>- combined across dates</span>}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem' }}>
                  {summary.overall_sum !== undefined && summary.overall_sum !== null ? summary.overall_sum.toFixed(2) : 'N/A'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Minimum {summary.field_count > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>- smallest value</span>}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.overall_min !== undefined && summary.overall_min !== null ? summary.overall_min.toFixed(2) : 'N/A'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Maximum {summary.field_count > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>- largest value</span>}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.overall_max !== undefined && summary.overall_max !== null ? summary.overall_max.toFixed(2) : 'N/A'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Average {summary.field_count > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>- across all values</span>}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.overall_avg !== undefined && summary.overall_avg !== null ? summary.overall_avg.toFixed(2) : 'N/A'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  {summary.field_count > 1 ? `Fields Selected` : 'Data Points'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.field_count || summary.total_count}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Trend {summary.field_count > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>- over time</span>}
                </td>
                <td style={{
                  padding: '0.75rem',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: summary.trend === 'increasing' ? 'var(--success-color)' :
                         summary.trend === 'decreasing' ? 'var(--error-color)' :
                         'var(--text-secondary)'
                }}>
                  {summary.trend}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem' }}>
                  Change {summary.field_count > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>- highest to 2nd highest</span>}
                </td>
                <td style={{
                  padding: '0.75rem',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: summary.change_percent > 0 ? 'var(--success-color)' :
                         summary.change_percent < 0 ? 'var(--error-color)' :
                         'var(--text-secondary)'
                }}>
                  {summary.change_percent !== undefined && summary.change_percent !== null ? `${summary.change_percent > 0 ? '+' : ''}${summary.change_percent.toFixed(1)}%` : 'N/A'}
                </td>
              </tr>
            </>
          )}

          {(type === 'counters' || type === 'timers') && (
            <>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Sum (Total)
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)', fontSize: '1.1rem' }}>
                  {summary.overall_sum !== undefined && summary.overall_sum !== null ? summary.overall_sum.toFixed(2) : 'N/A'}
                  {type === 'timers' && summary.overall_sum !== undefined && summary.overall_sum !== null && ' min'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Minimum
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.overall_min !== undefined && summary.overall_min !== null ? summary.overall_min.toFixed(2) : 'N/A'}
                  {type === 'timers' && summary.overall_min !== undefined && summary.overall_min !== null && ' min'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Maximum
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.overall_max !== undefined && summary.overall_max !== null ? summary.overall_max.toFixed(2) : 'N/A'}
                  {type === 'timers' && summary.overall_max !== undefined && summary.overall_max !== null && ' min'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Average
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.overall_avg !== undefined && summary.overall_avg !== null ? summary.overall_avg.toFixed(2) : 'N/A'}
                  {type === 'timers' && summary.overall_avg !== undefined && summary.overall_avg !== null && ' min'}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Data Points
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                  {summary.total_count}
                </td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem' }}>
                  Trend
                </td>
                <td style={{
                  padding: '0.75rem',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: summary.trend === 'increasing' ? 'var(--success-color)' :
                         summary.trend === 'decreasing' ? 'var(--error-color)' :
                         'var(--text-secondary)'
                }}>
                  {summary.trend}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '0.75rem' }}>
                  Change
                </td>
                <td style={{
                  padding: '0.75rem',
                  textAlign: 'right',
                  fontWeight: 'bold',
                  color: summary.change_percent > 0 ? 'var(--success-color)' :
                         summary.change_percent < 0 ? 'var(--error-color)' :
                         'var(--text-secondary)'
                }}>
                  {summary.change_percent !== undefined && summary.change_percent !== null ? `${summary.change_percent > 0 ? '+' : ''}${summary.change_percent.toFixed(1)}%` : 'N/A'}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default StatisticsTable;
