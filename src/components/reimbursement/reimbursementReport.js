import jsPDF from 'jspdf';
import moment from 'moment';

// Builds display rows from stored Reimbursement records.
// Paid amounts are used exactly as stored — never recalculated on download.
function buildRows(records) {
  return records.map((r) => ({
    vehicle: r.vehicle_name || '—',
    distance: Number(r.total_distance_km) || 0,
    rate: Number(r.fuel_rate) || 0,
    mileage: Number(r.mileage_kmpl) || 0,
    amount: Number(r.reimbursement_amount) || 0,
    paid: r.paid_amount != null ? Number(r.paid_amount) : null,
    status: r.status || 'unpaid',
  }));
}

export function monthLabel(month) {
  return moment(month, 'YYYY-MM').format('MMMM YYYY');
}

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadReimbursementCSV(records, month) {
  const rows = buildRows(records);
  const label = monthLabel(month);
  const lines = [['Vehicle', 'Total Distance (km)', 'Fuel Rate (AED/L)', 'Mileage (km/L)', 'Reimbursement (AED)', 'Paid Amount (AED)', 'Status'].join(',')];
  rows.forEach((r) => {
    lines.push([
      escapeCSV(r.vehicle),
      r.distance.toFixed(1),
      r.rate.toFixed(2),
      r.mileage.toFixed(1),
      r.amount.toFixed(2),
      r.paid != null ? r.paid.toFixed(2) : '—',
      r.status,
    ].join(','));
  });
  const totalDistance = rows.reduce((s, r) => s + r.distance, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.paid != null ? r.paid : 0), 0);
  lines.push('');
  lines.push([escapeCSV('TOTAL'), totalDistance.toFixed(1), '', '', totalAmount.toFixed(2), totalPaid.toFixed(2), ''].join(','));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vehicle_Reimbursement_${month}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadReimbursementPDF(records, month) {
  const rows = buildRows(records);
  const label = monthLabel(month);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;

  const cols = [
    { header: 'Vehicle', width: tableWidth * 0.22 },
    { header: 'Total Distance (km)', width: tableWidth * 0.17 },
    { header: 'Fuel Rate (AED/L)', width: tableWidth * 0.14 },
    { header: 'Mileage (km/L)', width: tableWidth * 0.12 },
    { header: 'Reimbursement (AED)', width: tableWidth * 0.15 },
    { header: 'Paid Amount (AED)', width: tableWidth * 0.12 },
    { header: 'Status', width: tableWidth * 0.08 },
  ];

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Vehicle Cash Reimbursement Report', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text(`Month: ${label}`, margin, 25);
  doc.text(`Generated: ${moment().format('MMM DD, YYYY HH:mm')}`, margin, 31);

  const totalDistance = rows.reduce((s, r) => s + r.distance, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.reduce((s, r) => s + (r.paid != null ? r.paid : 0), 0);
  doc.text(`${rows.length} vehicle(s)  •  Total distance: ${totalDistance.toFixed(1)} km  •  Total reimbursement: AED ${totalAmount.toFixed(2)}  •  Total paid: AED ${totalPaid.toFixed(2)}`, pageWidth - margin, 31, { align: 'right' });

  let y = 38;
  const rowHeight = 7.5;

  const drawHeader = () => {
    doc.setFillColor(219, 113, 22);
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
    const cells = [
      r.vehicle,
      r.distance.toFixed(1),
      r.rate.toFixed(2),
      r.mileage.toFixed(1),
      r.amount.toFixed(2),
      r.paid != null ? r.paid.toFixed(2) : '—',
      r.status.toUpperCase(),
    ];
    let x = margin;
    cells.forEach((cell, j) => {
      const text = String(cell).length > 38 ? String(cell).substring(0, 37) + '…' : String(cell);
      doc.text(text, x + 2, y + 5);
      x += cols[j].width;
    });
    y += rowHeight;
  });

  if (y > pageHeight - 15) { doc.addPage(); y = 20; }
  doc.setFillColor(245, 239, 232);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 50, 20);
  doc.text('TOTAL', margin + 2, y + 5);
  let x = margin;
  cols.forEach((col, j) => {
    if (j === 1) doc.text(totalDistance.toFixed(1), x + 2, y + 5);
    if (j === 4) doc.text(totalAmount.toFixed(2), x + 2, y + 5);
    if (j === 5) doc.text(totalPaid.toFixed(2), x + 2, y + 5);
    x += col.width;
  });

  doc.save(`Vehicle_Reimbursement_${month}.pdf`);
}