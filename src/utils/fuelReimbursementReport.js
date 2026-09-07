import jsPDF from 'jspdf';
import moment from 'moment';

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const REPORT_TITLE = 'Monthly Fuel Cash Reimbursement Report';
const REPORT_NOTE = 'Amount = (Distance / Mileage) x Fuel Rate  •  Fuel: Special 95';

export function downloadReimbursementCSV(rows, generatedAt) {
  const header = ['Month', 'Employee', 'Vehicle', 'Distance (km)', 'Fuel Rate (AED/L)', 'Mileage (km/L)', 'Fuel (L)', 'Amount (AED)', 'Status', 'Paid (AED)'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      escapeCSV(r.month),
      escapeCSV(r.employee),
      escapeCSV(r.vehicle),
      r.distance.toFixed(1),
      r.rate != null ? r.rate.toFixed(2) : '—',
      r.mileage,
      r.litres.toFixed(2),
      r.amount.toFixed(2),
      r.status === 'paid' ? 'Paid' : 'Not Paid',
      r.paid.toFixed(2),
    ].join(','));
  });
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  lines.push('');
  lines.push([escapeCSV('TOTAL'), '', '', '', '', '', '', totalAmount.toFixed(2), '', totalPaid.toFixed(2)].join(','));
  lines.push('');
  lines.push(escapeCSV(REPORT_NOTE));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Fuel_Reimbursement_Report_${moment().format('YYYY-MM-DD')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadReimbursementPDF(rows, generatedAt) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;

  const cols = [
    { header: 'Month', width: tableWidth * 0.14 },
    { header: 'Employee', width: tableWidth * 0.14 },
    { header: 'Vehicle', width: tableWidth * 0.16 },
    { header: 'Distance (km)', width: tableWidth * 0.09 },
    { header: 'Rate (AED/L)', width: tableWidth * 0.09 },
    { header: 'Mileage (km/L)', width: tableWidth * 0.08 },
    { header: 'Fuel (L)', width: tableWidth * 0.08 },
    { header: 'Amount (AED)', width: tableWidth * 0.09 },
    { header: 'Status', width: tableWidth * 0.07 },
    { header: 'Paid (AED)', width: tableWidth * 0.06 },
  ];

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(REPORT_TITLE, margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text(REPORT_NOTE, margin, 25);
  doc.text(`Generated: ${generatedAt}`, margin, 31);

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

  rows.forEach((r, i) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
      drawHeader();
    }
    if (i % 2 === 1) {
      doc.setFillColor(248, 245, 240);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    const cells = [
      String(r.month),
      String(r.employee),
      String(r.vehicle),
      r.distance.toFixed(1),
      r.rate != null ? r.rate.toFixed(2) : '—',
      String(r.mileage),
      r.litres.toFixed(2),
      r.amount.toFixed(2),
      r.status === 'paid' ? 'Paid' : 'Not Paid',
      r.paid.toFixed(2),
    ];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(45, 45, 45);
    let x = margin;
    cells.forEach((cell, j) => {
      const maxWidth = cols[j].width - 4;
      const text = cell.length > 30 ? cell.substring(0, 29) + '…' : cell;
      const align = j >= 3 ? 'right' : 'left';
      const xOffset = j >= 3 ? cols[j].width - 4 : 2;
      doc.text(text, x + xOffset, y + 5, align !== 'left' ? { align: 'right' } : undefined);
      x += cols[j].width;
    });
    y += rowHeight;
  });

  if (y > pageHeight - 15) { doc.addPage(); y = 20; }
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  doc.setFillColor(245, 239, 232);
  doc.rect(margin, y, tableWidth, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 50, 20);
  doc.text('TOTAL', margin + 2, y + 5);
  cols.forEach((col, j) => {
    const x = margin + col.width * (j + 1);
    if (j === 6) doc.text(totalAmount.toFixed(2), x - 4, y + 5, { align: 'right' });
    if (j === 8) doc.text(totalPaid.toFixed(2), x - 4, y + 5, { align: 'right' });
  });

  doc.save(`Fuel_Reimbursement_Report_${moment().format('YYYY-MM-DD')}.pdf`);
}