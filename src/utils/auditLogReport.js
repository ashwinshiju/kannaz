import jsPDF from 'jspdf';
import moment from 'moment';

const TZ = 240; // Asia/Dubai

const COLS = [
  { header: 'Timestamp', width: 0.18 },
  { header: 'User', width: 0.14 },
  { header: 'Email', width: 0.18 },
  { header: 'Action', width: 0.10 },
  { header: 'Module', width: 0.12 },
  { header: 'Entity', width: 0.10 },
  { header: 'Details', width: 0.18 },
];

function formatTimestamp(val) {
  if (!val) return '—';
  return moment(val).format('MMM DD, HH:mm:ss');
}

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadAuditCSV(rows) {
  const header = COLS.map(c => c.header);
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      escapeCSV(formatTimestamp(r.created_date)),
      escapeCSV(r.user_name),
      escapeCSV(r.user_email),
      escapeCSV(r.action),
      escapeCSV(r.module),
      escapeCSV(r.entity_type),
      escapeCSV(r.details),
    ].join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Audit_Log_${moment().format('YYYY-MM-DD')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAuditPDF(rows, generatedAt) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const tableWidth = pageWidth - margin * 2;

  // Header
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Audit Log', margin, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text(`Generated: ${generatedAt}`, margin, 22);
  doc.text(`${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`, pageWidth - margin, 22, { align: 'right' });

  const colWidths = COLS.map(c => tableWidth * c.width);
  let y = 28;
  const rowHeight = 7;

  const drawHeader = () => {
    doc.setFillColor(219, 113, 22);
    doc.rect(margin, y, tableWidth, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    let x = margin;
    COLS.forEach((col, j) => {
      doc.text(col.header, x + 2, y + 5);
      x += colWidths[j];
    });
    y += rowHeight;
  };
  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(45, 45, 45);

  rows.forEach((r, i) => {
    if (y > pageHeight - 15) {
      doc.addPage();
      y = 18;
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(45, 45, 45);
    }
    if (i % 2 === 1) {
      doc.setFillColor(248, 245, 240);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    const cells = [
      formatTimestamp(r.created_date),
      String(r.user_name || '—'),
      String(r.user_email || '—'),
      String(r.action || '—'),
      String(r.module || '—'),
      String(r.entity_type || '—'),
      String(r.details || '—'),
    ];
    let x = margin;
    cells.forEach((cell, j) => {
      const maxWidth = colWidths[j] - 3;
      const text = cell.length > Math.floor(maxWidth * 2.2) ? cell.substring(0, Math.floor(maxWidth * 2.2) - 1) + '…' : cell;
      doc.text(text, x + 2, y + 5);
      x += colWidths[j];
    });
    y += rowHeight;
  });

  doc.save(`Audit_Log_${moment().format('YYYY-MM-DD')}.pdf`);
}