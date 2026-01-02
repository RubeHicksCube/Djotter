/**
 * Generate CSV for task query results
 * @param {Object} queryData - Result from queryTasks function
 * @returns {string} CSV content
 */
function generateTasksCSV(queryData) {
  const rows = [];

  // Add header
  rows.push('Date,Task,Status,Created At,Completed At,Time to Complete (min)');

  // Add data rows
  queryData.data.forEach(group => {
    group.tasks.forEach(task => {
      let timeToComplete = '';
      if (task.done && task.completed_at && task.created_at) {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at);
        timeToComplete = Math.round((completed - created) / 1000 / 60);
      }

      const row = [
        task.date || '',
        `"${(task.text || '').replace(/"/g, '""')}"`, // Escape quotes in text
        task.done ? 'Completed' : 'Incomplete',
        task.created_at ? new Date(task.created_at).toLocaleString() : '',
        task.completed_at ? new Date(task.completed_at).toLocaleString() : '',
        timeToComplete
      ];

      rows.push(row.join(','));
    });
  });

  return rows.join('\n');
}

/**
 * Generate CSV for field analytics results
 * Simple format: just field name and value per row
 * @param {Object} queryData - Result from queryFieldValues + aggregations (includes fieldType)
 * @param {string} fieldKey - Field name
 * @returns {string} CSV content
 */
function generateFieldsCSV(queryData, fieldKey) {
  const rows = [];
  const fieldType = queryData.fieldType || 'number';

  // Add header
  rows.push('Date,Field Name,Value');

  // Add data rows - just date, fieldname, and value
  queryData.data.forEach(item => {
    let value = item.value !== null && item.value !== undefined ? item.value : '';

    // Format currency values with dollar sign
    if (fieldType === 'currency' && value !== '') {
      value = `$${parseFloat(value).toFixed(2)}`;
    }

    const row = [
      item.date || '',
      `"${fieldKey.replace(/"/g, '""')}"`, // Escape quotes
      value
    ];

    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Generate CSV for multiple fields combined
 * Creates a matrix with Date as first column, then each field as subsequent columns
 * @param {Array} fieldsData - Array of {fieldKey, fieldType, values}
 * @param {string} startDate - Start date for the range
 * @param {string} endDate - End date for the range
 * @returns {string} CSV content
 */
function generateMultiFieldsCSV(fieldsData, startDate, endDate) {
  if (!fieldsData || fieldsData.length === 0) {
    return 'Date\nNo data';
  }

  // Build a map of date -> {field: value} for all dates in range
  const dateMap = new Map();

  // Collect all dates from all fields
  fieldsData.forEach(fieldData => {
    fieldData.values.forEach(item => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, {});
      }
      dateMap.get(item.date)[fieldData.fieldKey] = {
        value: item.value,
        fieldType: fieldData.fieldType
      };
    });
  });

  // Sort dates
  const sortedDates = Array.from(dateMap.keys()).sort();

  // Build header row
  const header = ['Date', ...fieldsData.map(f => `"${f.fieldKey.replace(/"/g, '""')}"`)];
  const rows = [header.join(',')];

  // Build data rows
  sortedDates.forEach(date => {
    const rowData = dateMap.get(date);
    const row = [date];

    fieldsData.forEach(fieldData => {
      const fieldValue = rowData[fieldData.fieldKey];
      if (fieldValue) {
        let value = fieldValue.value;
        // Format currency values
        if (fieldValue.fieldType === 'currency' && value !== '') {
          value = `$${parseFloat(value).toFixed(2)}`;
        }
        row.push(value);
      } else {
        row.push(''); // No value for this date/field combination
      }
    });

    rows.push(row.join(','));
  });

  return rows.join('\n');
}

module.exports = {
  generateTasksCSV,
  generateFieldsCSV,
  generateMultiFieldsCSV
};
