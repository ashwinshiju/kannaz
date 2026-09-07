import { jsPDF } from 'jspdf';

const fmt2 = (n) => (Number(n) || 0).toFixed(2);

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const reimbursementTotal = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

export function downloadReimbursementCSV(monthLabel, rows) {
  const lines = [['Vehicle', 'Total Distance (km)', 'Fuel Rate (AED/L)', 'Mileage (km/L)', 'Reimbursement (AED)', 'Status'].join(',')];
  rows.forEach(r => {
    lines.push([
      `"${String(r.vehicle).replace(/"/g, '""')}"`,
      fmt2(r.distance_km), fmt2(r.fuel_rate), fmt2(r.mileage), fmt2(r.amount), r.status
    ].join(','));
  });
  lines.push(`"TOTAL",,,,${fmt2(reimbursementTotal(rows))},`);
  triggerDownload(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `cash-reimbursement-${monthLabel}.csv`);
}

export function downloadReimbursementPDF(monthLabel, rows) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text('Monthly Vehicle Cash Reimbursement Report', 14, 18);
  doc.setFontSize(10);
  doc.text(`Month: ${monthLabel}`, 14, 26);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
  doc.setFontSize(8);
  doc.text('Amount = Total Distance x Fuel Rate / Mileage. Paid amounts are frozen at the value stored when marked paid.', 14, 38, { maxWidth: 180 });

  let y = 48;
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.text('Vehicle', 14, y);
  doc.text('Distance (km)', 120, y, { align: 'right' });
  doc.text('Rate (AED/L)', 150, y, { align: 'right' });
  doc.text('Mileage', 172, y, { align: 'right' });
  doc.text('Amount (AED)', 200, y, { align: 'right' });
  doc.text('Status', 208, y);
  doc.line(14, y + 2, 220, y + 2);
  doc.setFont(undefined, 'normal');

  y += 8;
  rows.forEach(r => {
    if (y > 280) { doc.addPage(); y = 20; }
    doc.text(String(r.vehicle).slice(0, 42), 14, y);
    doc.text(fmt2(r.distance_km), 120, y, { align: 'right' });
    doc.text(fmt2(r.fuel_rate), 150, y, { align: 'right' });
    doc.text(fmt2(r.mileage), 172, y, { align: 'right' });
    doc.text(fmt2(r.amount), 200, y, { align: 'right' });
    doc.text(r.status, 208, y);
    y += 7;
  });

  if (y > 280) { doc.addPage(); y = 20; }
  doc.line(14, y, 220, y);
  doc.setFont(undefined, 'bold');
  doc.text('TOTAL', 14, y + 6);
  doc.text(fmt2(reimbursementTotal(rows)), 200, y + 6, { align: 'right' });

  doc.save(`cash-reimbursement-${monthLabel}.pdf`);
}