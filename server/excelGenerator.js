const ExcelJS = require('exceljs');

/**
 * Generate Excel workbook for task query results
 * @param {Object} queryData - Result from queryTasks function
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateTasksExcel(queryData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tasks');

  // Add headers
  worksheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Task', key: 'text', width: 50 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Created At', key: 'created_at', width: 20 },
    { header: 'Completed At', key: 'completed_at', width: 20 },
    { header: 'Time to Complete (min)', key: 'time_to_complete', width: 20 }
  ];

  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7B68EE' }
  };

  // Add data rows
  queryData.data.forEach(group => {
    group.tasks.forEach(task => {
      let timeToComplete = null;
      if (task.done && task.completed_at && task.created_at) {
        const created = new Date(task.created_at);
        const completed = new Date(task.completed_at);
        timeToComplete = Math.round((completed - created) / 1000 / 60);
      }

      worksheet.addRow({
        date: task.date,
        text: task.text,
        status: task.done ? 'Completed' : 'Incomplete',
        created_at: task.created_at ? new Date(task.created_at).toLocaleString() : 'N/A',
        completed_at: task.completed_at ? new Date(task.completed_at).toLocaleString() : 'N/A',
        time_to_complete: timeToComplete !== null ? timeToComplete : 'N/A'
      });
    });
  });

  // Add summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7B68EE' }
  };

  summarySheet.addRow({ metric: 'Total Tasks', value: queryData.summary.total });
  summarySheet.addRow({ metric: 'Completed Tasks', value: queryData.summary.completed });
  summarySheet.addRow({ metric: 'Incomplete Tasks', value: queryData.summary.incomplete });
  summarySheet.addRow({ metric: 'Completion Rate', value: `${(queryData.summary.completion_rate * 100).toFixed(1)}%` });
  if (queryData.summary.avg_time_to_complete_minutes) {
    summarySheet.addRow({ metric: 'Avg Time to Complete', value: `${queryData.summary.avg_time_to_complete_minutes} minutes` });
  }

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate Excel workbook for field analytics results
 * @param {Object} queryData - Result from queryFieldValues + aggregations
 * @param {string} fieldKey - Field name
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function generateFieldsExcel(queryData, fieldKey) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Field Data');

  // Add headers
  worksheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Value', key: 'value', width: 15 },
    { header: 'Min', key: 'min', width: 12 },
    { header: 'Max', key: 'max', width: 12 },
    { header: 'Average', key: 'avg', width: 15 },
    { header: 'Sum', key: 'sum', width: 15 },
    { header: 'Count', key: 'count', width: 10 }
  ];

  // Style headers
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7B68EE' }
  };

  // Add data rows
  queryData.data.forEach(item => {
    worksheet.addRow({
      date: item.date,
      value: item.value !== null && item.value !== undefined ? item.value : 'N/A',
      min: item.min !== undefined ? item.min.toFixed(2) : 'N/A',
      max: item.max !== undefined ? item.max.toFixed(2) : 'N/A',
      avg: item.avg !== undefined ? item.avg.toFixed(2) : 'N/A',
      sum: item.sum !== undefined ? item.sum.toFixed(2) : 'N/A',
      count: item.count !== undefined ? item.count : 'N/A'
    });
  });

  // Add summary sheet
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ];

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7B68EE' }
  };

  summarySheet.addRow({ metric: 'Field Name', value: fieldKey });
  summarySheet.addRow({ metric: 'Minimum', value: queryData.summary.overall_min !== null ? queryData.summary.overall_min.toFixed(2) : 'N/A' });
  summarySheet.addRow({ metric: 'Maximum', value: queryData.summary.overall_max !== null ? queryData.summary.overall_max.toFixed(2) : 'N/A' });
  summarySheet.addRow({ metric: 'Average', value: queryData.summary.overall_avg !== null ? queryData.summary.overall_avg.toFixed(2) : 'N/A' });
  summarySheet.addRow({ metric: 'Sum', value: queryData.summary.overall_sum !== null ? queryData.summary.overall_sum.toFixed(2) : 'N/A' });
  summarySheet.addRow({ metric: 'Count', value: queryData.summary.total_count });
  summarySheet.addRow({ metric: 'Trend', value: queryData.summary.trend });
  summarySheet.addRow({ metric: 'Change', value: `${queryData.summary.change_percent.toFixed(1)}%` });

  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  generateTasksExcel,
  generateFieldsExcel
};
