// Shared report-email building logic used by both the scheduled-report
// workflow function and the on-demand audit-log report function.

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDuration(mins) {
  if (mins == null || isNaN(mins)) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Asia/Dubai',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export function buildReportRows(trips, vehicleMap, employeeMap) {
  return trips.map((trip) => {
    const vehicle = trip.vehicle_id ? vehicleMap.get(trip.vehicle_id) : null;
    let vehicleLabel;
    if (vehicle) {
      const plate = vehicle.reg_no || '';
      const model = vehicle.model || vehicle.name || '';
      vehicleLabel = `${plate}${plate && model ? ' - ' : ''}${model}`.trim() || trip.vehicle_name || '—';
    } else {
      vehicleLabel = trip.vehicle_name || '—';
    }
    const emp = trip.employee_ref_id ? employeeMap.get(trip.employee_ref_id) : null;
    const empName = emp?.full_name || trip.employee_name || '—';
    return {
      tripNumber: trip.trip_number || '—',
      employee: empName,
      vehicle: vehicleLabel,
      start: trip.started_at,
      end: trip.completed_at,
      duration: trip.duration_minutes,
      purpose: trip.purpose || '—',
      distance: trip.distance_km,
    };
  });
}

export function getTotals(rows) {
  const totalDistance = rows.reduce((s, r) => s + (Number(r.distance) || 0), 0);
  const totalMinutes = rows.reduce((s, r) => s + (Number(r.duration) || 0), 0);
  return { totalDistance, totalMinutes, count: rows.length };
}

export function buildEmailBody(rows, rangeLabel, totalDistance, totalMinutes) {
  const rowsHtml = rows.length === 0
    ? '<tr><td colspan="8" style="padding:12px;text-align:center;color:#888;">No trips in this period.</td></tr>'
    : rows.map((r) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;">${escapeHtml(r.tripNumber)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.employee)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.vehicle)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap;">${formatDate(r.start)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap;">${formatDate(r.end)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${formatDuration(r.duration)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.purpose)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${r.distance != null ? Number(r.distance).toFixed(1) : '—'}</td>
      </tr>`).join('');

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;color:#333;">
  <h2 style="color:#db7116;margin-bottom:4px;">Trip Report</h2>
  <p style="color:#666;margin:0 0 8px;">Period: <strong>${escapeHtml(rangeLabel)}</strong></p>
  <p style="color:#666;margin:0 0 16px;">${rows.length} trip(s) &bull; Total distance: ${totalDistance.toFixed(1)} km &bull; Total duration: ${formatDuration(totalMinutes)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#db7116;color:#fff;">
        <th style="padding:8px 10px;text-align:left;">Trip #</th>
        <th style="padding:8px 10px;text-align:left;">Employee</th>
        <th style="padding:8px 10px;text-align:left;">Vehicle</th>
        <th style="padding:8px 10px;text-align:left;">Start</th>
        <th style="padding:8px 10px;text-align:left;">End</th>
        <th style="padding:8px 10px;text-align:left;">Duration</th>
        <th style="padding:8px 10px;text-align:left;">Purpose</th>
        <th style="padding:8px 10px;text-align:right;">Distance (km)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p style="color:#aaa;font-size:11px;margin-top:20px;">This report was generated and sent by Kannaz.</p>
</div>`;
}