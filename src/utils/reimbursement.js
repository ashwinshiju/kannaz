import jsPDF from 'jspdf';
import moment from 'moment';

// Vehicles included in the Monthly Vehicle Cash Reimbursement report.
// Extend this list to add more vehicles.
export const REIMBURSEMENT_VEHICLES = ["Binil's Deepal S05", "Joemon's Deepal S05"];

export const DEFAULT_MILEAGE = 14; // km/L
export const REIMBURSEMENT_START_MONTH = '2026-08'; // August 2026 onwards

const TZ = 240; // Asia/Dubai (UTC+4)

// UAE Special 95 monthly rates (AED/L) for months before the currently stored
// fuel price. The current month's rate comes from the stored fuel_prices
// setting; this history covers earlier months. Rates are editable per row.
export const SPECIAL_95_HISTORY = {
  '2025-10': 2.66, '2025-11': 2.51, '2025-12': 2.58,
  '2026-01': 2.42, '2026-02': 2.33, '2026-03': 2.48,
  '2026-04': 3.28, '2026-05': 3.55, '2026-06': 3.83,
  '2026-07': 3.29, '2026-08': 3.49, '2026-09': 3.69,
};

// Months from August 2026 up to the current month, newest first.
export function getReimbursementMonths() {
  const months = [];
  let m = moment.utc(`${REIMBURSEMENT_START_MONTH}-01`);
  const end = moment.utc().utcOffset(TZ).startOf('month');
  while (m.isSameOrBefore(end, 'month')) {
    months.push(m.format('YYYY-MM'));
    m = m.clone().add(1, 'month');
  }
  return months.reverse();
}

export function monthKeyToLabel(monthKey) {
  return moment.utc(`${monthKey}-01`).format('MMM YYYY');
}

// Default fuel rate for a month: Special 95, from the history map for past
// months, or from the currently stored fuel_prices setting.
export function getDefaultRate(monthKey, currentPrices) {
  return SPECIAL_95_HISTORY[monthKey] ?? currentPrices?.special_95 ?? 0;
}

// Total distance (km) per configured vehicle for trips started in the month.
// Uses the odometer-based distance_km, excluding cancelled trips.
export function getMonthVehicleDistance(trips, vehicleNames, monthKey) {
  const totals = {};
  vehicleNames.forEach((name) => { totals[name] = 0; });
  const monthStart = moment.utc(`${monthKey}-01`).utcOffset(TZ).startOf('month');
  const monthEnd = moment.utc(`${monthKey}-01`).utcOffset(TZ).endOf('month');
  trips.forEach((trip) => {
    if (trip.status === 'cancelled') return;
    if (!(trip.vehicle_name in totals)) return;
    const ts = trip.started_at || trip.created_date;
    if (!ts) return;
    const m = moment.utc(ts).utcOffset(TZ);
    if (m.isSameOrAfter(monthStart) && m.isSameOrBefore(monthEnd)) {
      totals[trip.vehicle_name] += Number(trip.distance_km) || 0;
    }
  });
  return totals;
}

export function computeAmount(distanceKm, rate, mileage) {
  if (!mileage) return 0;
  return (Number(distanceKm) || 0) * (Number(rate) || 0) / mileage;
}

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadReimbursementCSV(rows, monthKey) {
  const header = ['Paid', 'Vehicle', 'Distance (km)', 'Rate (AED/L)', 'Mileage (km/L)', 'Amount (AED)'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      r.paid ? 'Paid' : '—',
      escapeCSV(r.vehicleName),
      r.distance.toFixed(1),
      r.rate,
      r.mileage,
      r.amount.toFixed(2),
    ].join(','));
  });
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  lines.push('');
  lines.push(['TOTAL', '', '', '', '', total.toFixed(2)].join(','));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vehicle_Cash_Reimbursement_${monthKey}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadReimbursementPDF(rows, monthKey, generatedAt) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 9;

  const cols = [
    { header: 'PAID', width: tableWidth * 0.12, align: 'left' },
    { header: 'VEHICLE', width: tableWidth * 0.34, align: 'left' },
    { header: 'DISTANCE (KM)', width: tableWidth * 0.16, align: 'right' },
    { header: 'RATE (AED/L)', width: tableWidth * 0.13, align: 'right' },
    { header: 'MILEAGE (KM/L)', width: tableWidth * 0.13, align: 'right' },
    { header: 'AMOUNT (AED)', width: tableWidth * 0.12, align: 'right' },
  ];

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(74, 55, 40);
  doc.text('Monthly Vehicle Cash Reimbursement', margin, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 95, 80);
  doc.text(monthKeyToLabel(monthKey), margin, 27);
  doc.text(`Generated: ${generatedAt}`, pageWidth - margin, 27, { align: 'right' });

  // Table header
  let y = 36;
  doc.setFillColor(214, 123, 19);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  let x = margin;
  cols.forEach((col) => {
    doc.text(col.header, col.align === 'right' ? x + col.width - 3 : x + 3, y + 6, { align: col.align === 'right' ? 'right' : 'left' });
    x += col.width;
  });
  y += rowHeight;

  // Rows
  doc.setFont('helvetica', 'normal');
  rows.forEach((r, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 245, 240);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    doc.setTextColor(74, 55, 40);
    const cells = [
      r.paid ? 'Paid' : '—',
      r.vehicleName,
      r.distance.toFixed(1),
      String(r.rate),
      String(r.mileage),
      r.amount.toFixed(2),
    ];
    let cx = margin;
    cells.forEach((cell, j) => {
      const col = cols[j];
      doc.text(cell, col.align === 'right' ? cx + col.width - 3 : cx + 3, y + 6, { align: col.align === 'right' ? 'right' : 'left' });
      cx += col.width;
    });
    y += rowHeight;
  });

  // Total row
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  doc.setFillColor(245, 239, 232);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', margin + 3, y + 6);
  doc.text(total.toFixed(2), margin + tableWidth - 3, y + 6, { align: 'right' });

  doc.save(`Vehicle_Cash_Reimbursement_${monthKey}.pdf`);
}