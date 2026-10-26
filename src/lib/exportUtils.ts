export interface TraineeExportRow {
  fullName: string;
  contactNumber: string;
  emergencyContact: string;
  emergencyNumber: string;
  supervisorName: string;
  companyName: string;
  totalRenderedHours: number;
  affiliationStatus: string;
}

/**
 * Converts an array of objects into a downloaded CSV file
 */
export function exportToCsv(filename: string, rows: Record<string, any>[]): void {
  if (!rows || !rows.length) {
    alert('No data available to export.');
    return;
  }

  const separator = ',';
  const keys = Object.keys(rows[0]);

  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers a clean printable HTML document for saving as PDF
 */
export function printSummaryReport(params: {
  coordinatorName: string;
  batchTitle: string;
  data: TraineeExportRow[];
}): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up blocked. Please allow pop-ups to generate printable report.');
    return;
  }

  const rowsHtml = params.data
    .map(
      (item, index) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${item.fullName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.companyName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.supervisorName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${item.totalRenderedHours} hrs</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${item.affiliationStatus.toUpperCase()}</td>
      </tr>
    `
    )
    .join('');

  const reportHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>TraiNext OJT Summary Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 20px;
            font-size: 12px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin: 0;
            text-transform: uppercase;
          }
          .meta {
            margin-top: 5px;
            font-size: 11px;
            color: #475569;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 8px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
          }
          .signatures {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .sign-col {
            width: 40%;
            text-align: center;
          }
          .sign-line {
            border-top: 1px solid #0f172a;
            margin-top: 40px;
            padding-top: 5px;
            font-weight: bold;
          }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">TraiNext OJT Trainee Batch Accomplishment Report</div>
          <div class="meta">Generated: ${new Date().toLocaleDateString()} | Coordinator: ${params.coordinatorName}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 40px;">#</th>
              <th>Trainee Name</th>
              <th>Host Company</th>
              <th>Supervisor</th>
              <th style="text-align: center;">Total Rendered</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sign-col">
            <div>Prepared by:</div>
            <div class="sign-line">${params.coordinatorName}</div>
            <div style="font-size: 10px; color: #475569;">OJT Coordinator</div>
          </div>
          <div class="sign-col">
            <div>Noted by:</div>
            <div class="sign-line">Department Dean / Program Head</div>
            <div style="font-size: 10px; color: #475569;">College of Information Technology</div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(reportHtml);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}