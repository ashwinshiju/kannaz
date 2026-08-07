import jsPDF from 'jspdf';
import moment from 'moment';

const TZ = 240; // Asia/Dubai (UTC+4) — matches the offset used across the app

function formatDuration(mins) {
  if (mins == null || isNaN(mins)) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// Duration: prefer the stored duration_minutes (already computed from
// started_at → completed_at at trip end); fall back to a live calculation
// from the timestamps when the stored value is missing.
function getTripDuration(trip) {
  if (trip.duration_minutes != null) return trip.duration_minutes;
  if (trip.started_at && trip.completed_at) {
    return moment(trip.completed_at).diff(moment(trip.started_at), 'minutes', true);
  }
  return null;
}

// Distance: use distance_km — the odometer-based distance
// (end_odometer − start_odometer) captured at trip end.
function getTripDistance(trip) {
  return trip.distance_km;
}

// Vehicle label: plate + model. Prefers live Vehicle data via vehicle_id;
// falls back to the snapshot vehicle_name on the Trip record.
function getVehicleLabel(trip, vehicleMap) {
  const vehicle = trip.vehicle_id ? vehicleMap.get(trip.vehicle_id) : null;
  if (vehicle) {
    const plate = vehicle.reg_no || '';
    const model = vehicle.model || vehicle.name || '';
    return `${plate}${plate && model ? ' - ' : ''}${model}`.trim() || trip.vehicle_name || '—';
  }
  return trip.vehicle_name || '—';
}

// Employee name: prefers the live Employee record via employee_ref_id;
// falls back to the snapshot employee_name on the Trip record.
function getEmployeeName(trip, employeeMap) {
  const liveEmployee = trip.employee_ref_id ? employeeMap.get(trip.employee_ref_id) : null;
  return liveEmployee?.full_name || trip.employee_name || '—';
}

// Filter trips whose start date/time falls within [weekStart, weekEnd].
// Uses started_at (set when the trip is started); falls back to created_date
// for trips that were created but not yet started. weekStart/weekEnd are
// moment objects in Dubai time.
export function filterTripsByWeek(trips, weekStart, weekEnd) {
  return trips.filter((trip) => {
    const ts = trip.started_at || trip.created_date;
    if (!ts) return false;
    const m = moment.utc(ts);
    return m.isSameOrAfter(weekStart) && m.isSameOrBefore(weekEnd);
  });
}

export function buildReportRows(trips, vehicleMap, employeeMap) {
  return trips.map((trip) => {
    const start = trip.started_at ? moment.utc(trip.started_at).utcOffset(TZ) : null;
    return {
      tripNumber: trip.trip_number || '—',
      employee: getEmployeeName(trip, employeeMap),
      vehicle: getVehicleLabel(trip, vehicleMap),
      startDateTime: start ? start.format('MMM DD, YYYY HH:mm') : '—',
      duration: formatDuration(getTripDuration(trip)),
      durationMinutes: getTripDuration(trip),
      distance: getTripDistance(trip),
    };
  });
}

export function getWeekTotals(rows) {
  const totalMinutes = rows.reduce((sum, r) => sum + (r.durationMinutes || 0), 0);
  const totalDistance = rows.reduce((sum, r) => sum + (Number(r.distance) || 0), 0);
  return {
    duration: formatDuration(totalMinutes),
    distance: totalDistance.toFixed(1),
    count: rows.length,
  };
}

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCSV(rows, weekStart, weekEnd, totals) {
  const header = ['Trip #', 'Employee', 'Vehicle', 'Start Date & Time', 'Duration', 'Distance (km)'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      escapeCSV(r.tripNumber),
      escapeCSV(r.employee),
      escapeCSV(r.vehicle),
      escapeCSV(r.startDateTime),
      escapeCSV(r.duration),
      r.distance != null ? Number(r.distance).toFixed(1) : '—',
    ].join(','));
  });
  lines.push('');
  lines.push([
    escapeCSV('TOTAL'),
    '', '', '',
    escapeCSV(totals.duration),
    totals.distance,
  ].join(','));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Weekly_Trip_Report_${weekStart.format('YYYY-MM-DD')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPDF(rows, weekStart, weekEnd, totals, generatedAt) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;

  const cols = [
    { header: 'Trip #', width: tableWidth * 0.12 },
    { header: 'Employee', width: tableWidth * 0.22 },
    { header: 'Vehicle (Plate - Model)', width: tableWidth * 0.22 },
    { header: 'Start Date & Time', width: tableWidth * 0.18 },
    { header: 'Duration', width: tableWidth * 0.12 },
    { header: 'Distance (km)', width: tableWidth * 0.14 },
  ];

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Weekly Trip Report', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  const rangeStr = `${weekStart.format('MMM DD, YYYY')} – ${weekEnd.format('MMM DD, YYYY')}`;
  doc.text(`Week: ${rangeStr}`, margin, 25);
  doc.text(`Generated: ${generatedAt}`, margin, 31);
  doc.text(`${totals.count} trip(s)  •  Total distance: ${totals.distance} km  •  Total duration: ${totals.duration}`, pageWidth - margin, 31, { align: 'right' });

  // Table
  let y = 38;
  const rowHeight = 7.5;

  const drawHeader = () => {
    doc.setFillColor(219, 113, 22); // primary brand
    doc.rect(margin, y, tableWidth, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let x = margin;
    cols.forEach((col) => {
      doc.text(col.header, x + 2, y + 5);
      x += col.width;
    });
    y += rowHeight;
  };
  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(45, 45, 45);
  rows.forEach((r, i) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(45, 45, 45);
    }
    if (i % 2 === 1) {
      doc.setFillColor(248, 245, 240);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    let x = margin;
    const cells = [
      String(r.tripNumber),
      String(r.employee),
      String(r.vehicle),
      String(r.startDateTime),
      String(r.duration),
      r.distance != null ? Number(r.distance).toFixed(1) : '—',
    ];
    cells.forEach((cell, j) => {
      const maxWidth = cols[j].width - 4;
      const text = cell.length > 38 ? cell.substring(0, 37) + '…' : cell;
      doc.text(text, x + 2, y + 5);
      x += cols[j].width;
    });
    y += rowHeight;
  });

  // Totals row
  if (y > pageHeight - 15) { doc.addPage(); y = 20; }
  doc.setFillColor(245, 239, 232);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 50, 20);
  doc.text('TOTAL', margin + 2, y + 5);
  let x = margin;
  cols.forEach((col, j) => {
    if (j === 4) doc.text(totals.duration, x + 2, y + 5);
    if (j === 5) doc.text(totals.distance, x + 2, y + 5);
    x += col.width;
  });

  doc.save(`Weekly_Trip_Report_${weekStart.format('YYYY-MM-DD')}.pdf`);
}