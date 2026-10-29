export interface TraineeExportRow {
  fullName: string;
  email?: string;
  contactNumber?: string;
  emergencyContact?: string;
  emergencyNumber?: string;
  supervisorName: string;
  companyName: string;
  totalRenderedHours: number;
  affiliationStatus: string;
}

export interface IndividualLogRecord {
  date: string;
  time_in?: string | null;
  time_out?: string | null;
  hours_rendered?: number;
  status: string;
  safe_at_base_time?: string | null;
  transit_notes?: string | null;
}

/**
 * CSV Exporter Utility
 */
export function exportToCsv(filename: string, rows: Record<string, any>[]): void {
  if (!rows || !rows.length) return;

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
 * 1. PANG-LAHATAN: Coordinator Master Summary Report HTML
 */
export function generateMasterReportHtml(params: {
  coordinatorName: string;
  batchTitle?: string;
  data: TraineeExportRow[];
}): string {
  const rowsHtml = params.data
    .map(
      (item, index) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${index + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 700; color: #0f172a;">${item.fullName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.companyName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px;">${item.supervisorName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #0284c7;">
          ${Number(item.totalRenderedHours || 0).toFixed(1)} hrs
        </td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; ${
            item.affiliationStatus === 'COMPLETED'
              ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;'
              : 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;'
          }">
            ${item.affiliationStatus}
          </span>
        </td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>TraiNext — OJT Cohort Master Summary Report</title>
        <style>
          @page { size: portrait; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 11px; background: #fff; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 12px; font-weight: 600; color: #0284c7; margin: 4px 0 0; }
          .meta { margin-top: 6px; font-size: 10px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .signatures { margin-top: 45px; display: flex; justify-content: space-between; }
          .sign-col { width: 42%; text-align: center; }
          .sign-line { border-top: 1px solid #0f172a; margin-top: 45px; padding-top: 5px; font-weight: 700; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">TraiNext OJT Trainee Master Summary Audit</div>
          <div class="subtitle">${params.batchTitle || 'Academic Practicum Monitoring Records'}</div>
          <div class="meta">Date Generated: ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} | Coordinator: ${params.coordinatorName}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 35px;">#</th>
              <th>Trainee Name</th>
              <th>Host Training Company</th>
              <th>Designated Supervisor</th>
              <th style="text-align: center; width: 110px;">Rendered Hours</th>
              <th style="text-align: center; width: 90px;">Status</th>
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
            <div style="font-size: 10px; color: #64748b;">OJT Academic Coordinator</div>
          </div>
          <div class="sign-col">
            <div>Noted by:</div>
            <div class="sign-line">Dean / Department Chair</div>
            <div style="font-size: 10px; color: #64748b;">College of Information Technology</div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * 2. PANG-ISA-ISA: Individual Trainee DTR & Transit Safety Accountability Log HTML
 */
export function generateIndividualDtrHtml(params: {
  internName: string;
  companyName: string;
  supervisorName: string;
  contactNumber?: string;
  coordinatorName: string;
  totalRendered: number;
  logs: IndividualLogRecord[];
}): string {
  const formatTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const rowsHtml = params.logs.length === 0 
    ? `<tr><td colspan="6" style="text-align: center; padding: 15px; color: #94a3b8;">No official duty logs recorded yet.</td></tr>`
    : params.logs
        .map(
          (log, index) => `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold;">${index + 1}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; font-size: 11px;">${log.date}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; text-align: center;">${formatTime(log.time_in)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-family: monospace; text-align: center;">${formatTime(log.time_out)}</td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold; color: #0284c7;">
            ${Number(log.hours_rendered || 0).toFixed(1)} hrs
          </td>
          <td style="border: 1px solid #cbd5e1; padding: 6px; font-size: 10px;">
            ${
              log.safe_at_base_time
                ? `<span style="color: #059669; font-weight: bold;">✓ Safe: ${formatTime(log.safe_at_base_time)}</span>`
                : `<span style="color: #d97706; font-weight: 600;">Pending Confirmation</span>`
            }
            ${log.transit_notes ? `<div style="font-size: 9px; color: #64748b; margin-top: 2px;">Note: ${log.transit_notes}</div>` : ''}
          </td>
        </tr>
      `
        )
        .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>TraiNext Individual DTR — ${params.internName}</title>
        <style>
          @page { size: portrait; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 11px; background: #fff; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 12px; font-weight: 600; color: #0284c7; margin: 4px 0 0; }
          .profile-box { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 20px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 6px; text-align: left; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; }
          .signatures { margin-top: 45px; display: flex; justify-content: space-between; }
          .sign-col { width: 42%; text-align: center; }
          .sign-line { border-top: 1px solid #0f172a; margin-top: 45px; padding-top: 5px; font-weight: 700; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Individual Trainee Daily Time Record & Safety Audit</div>
          <div class="subtitle">TraiNext Geofenced Attendance & Base Transit Verification</div>
        </div>

        <div class="profile-box">
          <div><strong>Trainee Name:</strong> ${params.internName}</div>
          <div><strong>Total Hours Rendered:</strong> <span style="color: #0284c7; font-weight: bold;">${params.totalRendered.toFixed(1)} hrs</span></div>
          <div><strong>Host Training Company:</strong> ${params.companyName}</div>
          <div><strong>Company Supervisor:</strong> ${params.supervisorName}</div>
          <div><strong>Contact Number:</strong> ${params.contactNumber || 'N/A'}</div>
          <div><strong>OJT Coordinator:</strong> ${params.coordinatorName}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 30px;">#</th>
              <th style="width: 80px;">Date</th>
              <th style="text-align: center; width: 75px;">Time In</th>
              <th style="text-align: center; width: 75px;">Time Out</th>
              <th style="text-align: center; width: 90px;">Rendered</th>
              <th>Safe at Base Transit Verification</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sign-col">
            <div>Verified & Concurred by:</div>
            <div class="sign-line">${params.supervisorName}</div>
            <div style="font-size: 10px; color: #64748b;">Industry Supervisor Signature</div>
          </div>
          <div class="sign-col">
            <div>Noted & Audited by:</div>
            <div class="sign-line">${params.coordinatorName}</div>
            <div style="font-size: 10px; color: #64748b;">OJT Academic Coordinator Signature</div>
          </div>
        </div>
      </body>
    </html>
  `;
}