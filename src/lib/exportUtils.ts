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
  am_arrival?: string | null;
  am_departure?: string | null;
  pm_arrival?: string | null;
  pm_departure?: string | null;
  time_in?: string | null;
  time_out?: string | null;
  hours_rendered?: number;
  under_time_hours?: number;
  under_time_minutes?: number;
  status: string;
  safe_at_base_time?: string | null;
  transit_notes?: string | null;
}

/**
 * Global Helper to format timestamps and time strings accurately to Philippine Standard Time (12-hour format)
 */
export function formatTime(timeStr?: string | null, fallback = ''): string {
  if (!timeStr) return fallback;
  try {
    let dateObj: Date;
    if (timeStr.includes('T') || timeStr.includes('-')) {
      dateObj = new Date(timeStr);
    } else {
      const parts = timeStr.split(':');
      if (parts.length >= 2) {
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        dateObj = new Date();
        dateObj.setHours(h, m, 0, 0);
      } else {
        return timeStr;
      }
    }
    if (isNaN(dateObj.getTime())) return timeStr;
    
    // Pilitin nating gamitin ang Asia/Manila time zone upang laging tumpak sa PH time
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(dateObj);
  } catch {
    return fallback;
  }
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
 * 1. Coordinator Master Summary Report HTML (A4 Portrait, Pastel Blue Headers, Target/Rendered/Remaining/Status)
 */
export function generateMasterReportHtml(params: {
  coordinatorName: string;
  batchTitle?: string;
  data: TraineeExportRow[];
}): string {
  const TARGET_HOURS = 486;

  const rowsHtml = params.data
    .map((item, index) => {
      const rendered = Number(item.totalRenderedHours || 0);
      const remaining = Math.max(0, TARGET_HOURS - rendered);
      
      let statusText = item.affiliationStatus || 'On-Going';
      if (statusText === 'COMPLETED') statusText = 'Completed';
      else if (statusText === 'DELAYED') statusText = 'Delayed';
      else if (statusText !== 'Completed' && statusText !== 'Delayed') statusText = 'On-Going';

      return `
      <tr>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${index + 1}</td>
        <td style="border: 1px solid #000; padding: 4px; font-weight: bold;">${item.fullName}</td>
        <td style="border: 1px solid #000; padding: 4px;">${item.companyName}</td>
        <td style="border: 1px solid #000; padding: 4px;">${item.supervisorName}</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${TARGET_HOURS} hrs</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${rendered.toFixed(1)} hrs</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${remaining.toFixed(1)} hrs</td>
        <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 9.5px; font-weight: bold;">
          ${statusText}
        </td>
      </tr>
    `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>OJT Cohort Summary Report</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; background: #fff !important; color: #000; margin: 0; padding: 15px; font-size: 11px; }
          .page-container {
            width: 100%;
            max-width: 185mm;
            margin: 0 auto;
            background: #fff !important;
            box-sizing: border-box;
          }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
          .title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 11px; font-style: italic; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #fff !important; }
          th { background: #e0f2fe; border: 1px solid #000; color: #000; padding: 6px 4px; text-align: center; font-size: 9px; font-weight: bold; }
          .signatures { margin-top: 35px; display: flex; justify-content: space-between; }
          .sign-box { width: 45%; text-align: center; }
          .sign-line { border-top: 1px solid #000; margin-top: 35px; padding-top: 4px; font-weight: bold; font-size: 11px; }

          @media screen and (max-width: 768px) {
            .page-container {
              overflow-x: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="header">
            <div class="title"><strong>OJT Trainee Batch Master Progress and Status Report</strong></div>
            <div class="subtitle">${params.batchTitle || 'Academic Practicum Monitoring Records'}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px;">#</th>
                <th>Trainee Name</th>
                <th>Host Training Company</th>
                <th>Industry Supervisor</th>
                <th style="width: 55px;">Target Hours</th>
                <th style="width: 55px;">Rendered Hours</th>
                <th style="width: 55px;">Remaining Hours</th>
                <th style="width: 65px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="font-size: 10px; margin-bottom: 20px;">
            This master summary report compiles the real-time progress, rendered hours, and completion status of interns enrolled under the TraiNext institutional tracking system.
          </div>

          <div class="signatures">
            <div class="sign-box">
              <div class="sign-line"><strong>${params.coordinatorName}</strong></div>
              <div style="font-size: 9.5px; margin-top: 2px;">OJT Academic Coordinator</div>
            </div>
            <div class="sign-box">
              <div class="sign-line"><strong>John Edgar Anthony</strong></div>
              <div style="font-size: 9.5px; margin-top: 2px;">Dean, College of Computer Studies</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getMonthDaysCount(yearMonth: string): { weekdays: number; saturdays: number } {
  try {
    const [yStr, mStr] = yearMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    if (isNaN(year) || isNaN(month)) return { weekdays: 22, saturdays: 4 };

    let weekdays = 0;
    let saturdays = 0;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdays++;
      } else if (dayOfWeek === 6) {
        saturdays++;
      }
    }
    return { weekdays, saturdays };
  } catch {
    return { weekdays: 22, saturdays: 4 };
  }
}

function buildSingleDtrBlockHtml(params: {
  internName: string;
  yearMonthKey: string;
  monthName: string;
  logs: IndividualLogRecord[];
}): string {
  const logMap = new Map<number, IndividualLogRecord>();
  params.logs.forEach((log) => {
    if (log.date) {
      const dayNum = parseInt(log.date.split('-')[2], 10);
      if (!isNaN(dayNum)) {
        logMap.set(dayNum, log);
      }
    }
  });

  let rowsHtml = '';
  let totalHoursSum = 0;

  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth() + 1;
  const currentDay = todayDate.getDate();
  const currentHour = todayDate.getHours();

  const [targetYear, targetMonth] = params.yearMonthKey.split('-').map(v => parseInt(v, 10));

  for (let day = 1; day <= 31; day++) {
    const log = logMap.get(day);
    
    let isPastDay = false;
    let isToday = false;

    if (targetYear < currentYear || (targetYear === currentYear && targetMonth < currentMonth)) {
      isPastDay = true;
    } else if (targetYear === currentYear && targetMonth === currentMonth) {
      if (day < currentDay) {
        isPastDay = true;
      } else if (day === currentDay) {
        isToday = true;
      }
    }

    const hasAmRecord = log && (log.am_arrival || (log.time_in && parseInt(log.time_in.split(':')[0], 10) < 12));
    const hasPmRecord = log && (log.pm_arrival || log.pm_departure || log.time_out);

    const shouldExpireAm = isPastDay || (isToday && currentHour >= 12);
    const amArr = log && hasAmRecord ? formatTime(log.am_arrival || log.time_in) : (shouldExpireAm ? '—' : '');
    const amDep = log && hasAmRecord ? formatTime(log.am_departure) : (shouldExpireAm ? '—' : '');
    
    const shouldExpirePm = isPastDay || (isToday && currentHour >= 18);
    const pmArr = log && hasPmRecord ? formatTime(log.pm_arrival) : (shouldExpirePm ? '—' : '');
    const pmDep = log && hasPmRecord ? formatTime(log.pm_departure || log.time_out) : (shouldExpirePm ? '—' : '');
    
    const utHours = log?.under_time_hours || '';
    const utMins = log?.under_time_minutes || '';
    
    if (log?.hours_rendered) {
      totalHoursSum += Number(log.hours_rendered);
    }

    rowsHtml += `
      <tr>
        <td style="border: 1px solid #000; padding: 1.5px 2px; text-align: center; font-size: 8.5px; font-family: Arial, sans-serif; font-weight: bold;">${day}</td>
        <td style="border: 1px solid #000; padding: 1.5px 2px; text-align: center; font-size: 8.5px; font-family: monospace;">${amArr}</td>
        <td style="border: 1px solid #000; padding: 1.5px 2px; text-align: center; font-size: 8.5px; font-family: monospace;">${amDep}</td>
        <td style="border: 1px solid #000; padding: 1.5px 2px; text-align: center; font-size: 8.5px; font-family: monospace;">${pmArr}</td>
        <td style="border: 1px solid #000; padding: 1.5px 2px; text-align: center; font-size: 8.5px; font-family: monospace;">${pmDep}</td>
        <td style="border: 1px solid #000; padding: 1.5px 2px; text-align: center; font-size: 8.5px; font-family: monospace;">${utHours}</td>
        <td style="border: 1px solid #000; padding: 1.5px 2px; text-align: center; font-size: 8.5px; font-family: monospace;">${utMins}</td>
      </tr>
    `;
  }

  const { weekdays, saturdays } = getMonthDaysCount(params.yearMonthKey);

  return `
    <div class="dtr-column">
      <div style="font-size: 9px; font-family: Arial, sans-serif; font-style: italic; margin-bottom: 2px;">Civil Service Form No. 48</div>
      <div class="dtr-title-header">DAILY TIME RECORD</div>
      
      <div class="dtr-meta-info">
        <div style="text-align: center; font-size: 9.5px; margin-bottom: 3px;">
          <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>${params.internName}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u><br>
          <span style="font-size: 8px; font-style: italic;">(Name)</span>
        </div>
        <div style="font-size: 8.5px; margin-bottom: 2px;">
          For the month of <u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>${params.monthName}</strong>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u>
        </div>
        <div style="font-size: 7.5px; margin-bottom: 3px; line-height: 1.2;">
          Official hours for arrival and departure<br>
          Regular days: <strong>${weekdays}</strong><br>
          Saturdays: <strong>${saturdays}</strong>
        </div>
      </div>

      <table class="dtr-template-table">
        <thead>
          <tr>
            <th rowspan="2" style="width: 22px;">Day</th>
            <th colspan="2">A.M.</th>
            <th colspan="2">P.M.</th>
            <th colspan="2">Undertime</th>
          </tr>
          <tr>
            <th style="width: 36px;">Arrival</th>
            <th style="width: 36px;">Departure</th>
            <th style="width: 36px;">Arrival</th>
            <th style="width: 36px;">Departure</th>
            <th style="width: 20px;">Hrs</th>
            <th style="width: 20px;">Mins</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr>
            <td style="border: 1px solid #000; padding: 2px; text-align: left; font-size: 8.5px;">Total</td>
            <td colspan="6" style="border: 1px solid #000; padding: 2px; text-align: right; font-size: 8.5px; font-family: monospace; padding-right: 6px;">
              ${totalHoursSum > 0 ? totalHoursSum.toFixed(1) + ' hrs' : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="dtr-cert">
        <em>I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.</em>
      </div>

      <div class="dtr-verify-section">
        <div style="font-size: 7.5px; margin-bottom: 2px; text-align: left;"><em>VERIFIED as to the prescribed office hours:</em></div>
        <div class="dtr-sign-line"><strong>In Charge</strong></div>
      </div>
    </div>
  `;
}

/**
 * 2. Official Daily Time Record (DTR Audit)
 */
export function generateCivilServiceDtrHtml(params: {
  internName: string;
  companyName: string;
  supervisorName: string;
  contactNumber?: string;
  coordinatorName: string;
  totalRendered: number;
  logs: IndividualLogRecord[];
}): string {
  const monthMap = new Map<string, IndividualLogRecord[]>();
  params.logs.forEach((log) => {
    if (log.date) {
      const monthKey = log.date.substring(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, []);
      }
      monthMap.get(monthKey)!.push(log);
    }
  });

  let sortedMonths = Array.from(monthMap.keys()).sort();
  if (sortedMonths.length === 0) {
    const currentMonth = new Date().toISOString().substring(0, 7);
    sortedMonths = [currentMonth];
    monthMap.set(currentMonth, []);
  }

  const selectedMonths = sortedMonths.slice(-2);
  if (selectedMonths.length === 1) {
    selectedMonths.unshift(selectedMonths[0]);
  }

  const formatMonthName = (yearMonth: string) => {
    try {
      const [y, m] = yearMonth.split('-');
      const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return yearMonth;
    }
  };

  const block1Html = buildSingleDtrBlockHtml({
    internName: params.internName,
    yearMonthKey: selectedMonths[0],
    monthName: formatMonthName(selectedMonths[0]),
    logs: monthMap.get(selectedMonths[0]) || [],
  });

  const block2Html = buildSingleDtrBlockHtml({
    internName: params.internName,
    yearMonthKey: selectedMonths[1],
    monthName: formatMonthName(selectedMonths[1]),
    logs: monthMap.get(selectedMonths[1]) || [],
  });

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Civil Service Form No. 48 — ${params.internName}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: Arial, sans-serif; color: #000; margin: 0; padding: 10px; background: #fff !important; }
          .page-container {
            width: 100%;
            max-width: 190mm;
            margin: 0 auto;
            background: #fff !important;
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            align-items: flex-start;
            gap: 10mm;
            box-sizing: border-box;
          }
          .dtr-column {
            width: 90mm;
            background: #fff !important;
            border: 1px solid #475569;
            padding: 4mm 4mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .dtr-title-header {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            margin-bottom: 3px;
            letter-spacing: 0.3px;
          }
          .dtr-meta-info {
            font-size: 9.5px;
            margin-bottom: 4px;
          }
          table.dtr-template-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
            background: #fff !important;
          }
          table.dtr-template-table th, table.dtr-template-table td {
            border: 1px solid #000;
            text-align: center;
            background: #fff !important;
          }
          table.dtr-template-table th {
            padding: 2px 1px;
            font-size: 8.5px;
            font-weight: bold;
            background: #fff !important;
          }
          .dtr-cert {
            font-size: 8.5px;
            line-height: 1.25;
            text-align: justify;
            margin-bottom: 6px;
          }
          .dtr-verify-section {
            width: 150px;
            margin-left: auto;
            text-align: center;
          }
          .dtr-sign-line {
            border-top: 1px solid #000;
            margin-top: 18px;
            padding-top: 2px;
            font-size: 9.5px;
          }

          @media screen and (max-width: 768px) {
            .page-container {
              flex-direction: column !important;
              align-items: center !important;
              gap: 20px !important;
              overflow-x: auto;
            }
            .dtr-column {
              width: 100% !important;
              max-width: 95vw !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          ${block1Html}
          ${block2Html}
        </div>
      </body>
    </html>
  `;
}

/**
 * 3. TraiNext Safety Audit Report 
 */
export function generateSafetyAuditHtml(params: {
  internName: string;
  companyName: string;
  supervisorName: string;
  contactNumber?: string;
  coordinatorName: string;
  totalRendered: number;
  logs: IndividualLogRecord[];
}): string {
  const rowsHtml = params.logs.length === 0 
    ? `<tr><td colspan="11" style="text-align: center; padding: 20px; color: #64748b;">No safety or transit logs recorded yet.</td></tr>`
    : params.logs
        .map((log, index) => {
          const hasAmRecord = log.am_arrival || (log.time_in && parseInt(log.time_in.split(':')[0], 10) < 12);
          const amArr = hasAmRecord ? formatTime(log.am_arrival || log.time_in, '—') : '—';
          const amDep = hasAmRecord ? formatTime(log.am_departure, '—') : '—';

          return `
        <tr>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${index + 1}</td>
          <td style="border: 1px solid #000; padding: 4px; font-family: monospace; text-align: center;">${log.date}</td>
          <td style="border: 1px solid #000; padding: 4px; font-family: monospace; text-align: center;">${amArr}</td>
          <td style="border: 1px solid #000; padding: 4px; font-family: monospace; text-align: center;">${amDep}</td>
          <td style="border: 1px solid #000; padding: 4px; font-family: monospace; text-align: center;">${formatTime(log.pm_arrival, '—')}</td>
          <td style="border: 1px solid #000; padding: 4px; font-family: monospace; text-align: center;">${formatTime(log.pm_departure || log.time_out, '—')}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${log.under_time_hours || 0}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${log.under_time_minutes || 0}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; font-family: monospace;">${formatTime(log.safe_at_base_time, '—')}</td>
          <td style="border: 1px solid #000; padding: 4px; text-align: center; font-size: 9px;">
            ${log.safe_at_base_time ? 'Safe At Base' : 'Pending'}
          </td>
          <td style="border: 1px solid #000; padding: 4px; font-size: 9px; font-family: monospace;">
            ${log.transit_notes || '—'}
          </td>
        </tr>
      `;
        })
        .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Safety Audit Report — ${params.internName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: Arial, sans-serif; background: #fff !important; color: #000; margin: 0; padding: 15px; font-size: 11px; }
          .page-container {
            width: 100%;
            max-width: 185mm;
            margin: 0 auto;
            background: #fff !important;
            box-sizing: border-box;
          }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
          .title { font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 11px; font-style: italic; margin-top: 2px; }
          .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; border: 1px solid #000; padding: 10px; margin-bottom: 15px; font-size: 10.5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; background: #fff !important; }
          th { background: #e0f2fe; border: 1px solid #000; color: #000; padding: 5px 3px; text-align: center; font-size: 8.5px; font-weight: bold; }
          .signatures { margin-top: 35px; display: flex; justify-content: space-between; }
          .sign-box { width: 45%; text-align: center; }
          .sign-line { border-top: 1px solid #000; margin-top: 35px; padding-top: 4px; font-weight: bold; font-size: 11px; }

          @media screen and (max-width: 768px) {
            .profile-grid {
              grid-template-columns: 1fr !important;
            }
            .page-container {
              overflow-x: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="header">
            <div class="title"><strong>Trainee Safety &amp; Transit Audit Report</strong></div>
            <div class="subtitle">Geofence Compliance &amp; Safe-at-Base Monitoring Log</div>
          </div>

          <div class="profile-grid">
            <div>
              <div><strong>Trainee Name</strong></div>
              <div>${params.internName}</div>
            </div>
            <div>
              <div><strong>Total Rendered Hours</strong></div>
              <div>${params.totalRendered.toFixed(1)} hrs</div>
            </div>
            <div>
              <div><strong>Host Training Company</strong></div>
              <div>${params.companyName}</div>
            </div>
            <div>
              <div><strong>Company Supervisor</strong></div>
              <div>${params.supervisorName}</div>
            </div>
            <div>
              <div><strong>Contact Number</strong></div>
              <div>${params.contactNumber || 'N/A'}</div>
            </div>
            <div>
              <div><strong>OJT Academic Coordinator</strong></div>
              <div>${params.coordinatorName}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 25px;">#</th>
                <th rowspan="2" style="width: 70px;">Date</th>
                <th colspan="2">A.M. Entry</th>
                <th colspan="2">P.M. Entry</th>
                <th colspan="2">Undertime</th>
                <th rowspan="2" style="width: 55px;">Safety Time</th>
                <th rowspan="2" style="width: 70px;">Safety Status</th>
                <th rowspan="2">Safety Notes</th>
              </tr>
              <tr>
                <th style="width: 42px;">Arrival</th>
                <th style="width: 42px;">Departure</th>
                <th style="width: 42px;">Arrival</th>
                <th style="width: 42px;">Departure</th>
                <th style="width: 25px;">Hours</th>
                <th style="width: 25px;">Mins</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div style="font-size: 10px; margin-bottom: 20px;">
            I certify on my honor that the above monitoring entries correspond to the actual transit and safe-at-base records submitted via the TraiNext system.
          </div>

          <div class="signatures">
            <div class="sign-box">
              <div class="sign-line"><strong>${params.supervisorName}</strong></div>
              <div style="font-size: 9.5px; margin-top: 2px;">Industry Supervisor Signature</div>
            </div>
            <div class="sign-box">
              <div class="sign-line"><strong>${params.coordinatorName}</strong></div>
              <div style="font-size: 9.5px; margin-top: 2px;">OJT Academic Coordinator Signature</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}