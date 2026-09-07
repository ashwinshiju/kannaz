import jsPDF from 'jspdf';
import moment from 'moment';

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// rows: [{ monthLabel, employeeName, tripCount, distance, rate, mileage, amount, paidLabel, paidAtLabel }]
// meta: { fuelTypeLabel, mileage, generatedAt }
export function downloadDisbursementCSV(rows, meta) {
  const header = ['Month', 'Employee', 'Trips', 'Distance (km)', 'Fuel Rate (AED/L)', 'Mileage (km/L)', 'Amount (AED)', 'Paid', 'Paid At'];
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      escapeCSV(r.monthLabel),
      escapeCSV(r.employeeName),
      r.tripCount,
      r.distance.toFixed(1),
      r.rate.toFixed(2),
      r.mileage,
      r.amount.toFixed(2),
      escapeCSV(r.paidLabel),
      escapeCSV(r.paidAtLabel || '—'),
    ].join(','));
  });
  const unpaid = rows.filter((r) => r.paidLabel !== 'Paid');
  lines.push('');
  lines.push([escapeCSV('UNPAID TOTAL'), '', '', '', '', '', unpaid.reduce((s, r) => s + r.amount, 0).toFixed(2), '', ''].join(','));
  lines.push([escapeCSV(`Mileage used: ${meta.mileage} km/L`), escapeCSV(`Fuel rate type: ${meta.fuelTypeLabel}`), escapeCSV(`Generated: ${meta.generatedAt}`)].join(','));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Cash_Disbursement_${moment().format('YYYY-MM-DD')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadDisbursementPDF(rows, meta) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const tableWidth = pageWidth - margin * 2;

  const cols = [
    { header: 'Month', width: tableWidth * 0.18 },
    { header: 'Employee', width: tableWidth * 0.20 },
    { header: 'Trips', width: tableWidth * 0.08 },
    { header: 'Distance (km)', width: tableWidth * 0.14 },
    { header: 'Rate (AED/L)', width: tableWidth * 0.12 },
    { header: 'Amount (AED)', width: tableWidth * 0.15 },
    { header: 'Paid', width: tableWidth * 0.13 },
  ];

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Cash Disbursement Report', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text(`Fuel rate type: ${meta.fuelTypeLabel}  •  Mileage: ${meta.mileage} km/L  •  Amount = Distance / Mileage x Rate`, margin, 25);
  doc.text(`Generated: ${meta.generatedAt}`, margin, 31);

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
      r.monthLabel,
      r.employeeName,
      String(r.tripCount),
      r.distance.toFixed(1),
      r.rate.toFixed(2),
      r.amount.toFixed(2),
      r.paidLabel,
    ];
    let x = margin;
    cells.forEach((cell, j) => {
      const maxWidth = cols[j].width - 4;
      const text = cell.length > 40 ? cell.substring(0, 39) + '…' : cell;
      doc.text(text, x + 2, y + 5);
      x += cols[j].width;
    });
    y += rowHeight;
  });

  const unpaidTotal = rows.filter((r) => r.paidLabel !== 'Paid').reduce((s, r) => s + r.amount, 0);
  const paidTotal = rows.filter((r) => r.paidLabel === 'Paid').reduce((s, r) => s + r.amount, 0);
  y += 4;
  if (y > pageHeight - 15) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(80, 50, 20);
  doc.text(`Unpaid total: AED ${unpaidTotal.toFixed(2)}  •  Paid total: AED ${paidTotal.toFixed(2)}`, margin, y);

  doc.save(`Cash_Disbursement_${moment().format('YYYY-MM-DD')}.pdf`);
}