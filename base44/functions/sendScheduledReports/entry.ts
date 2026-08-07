import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  const base44 = createClientFromRequest(req);

  // --- Authorization: two allowed paths ---
  // Path 1: Shared secret (scheduled workflow has no user session)
  // Path 2: Authenticated admin (manual call from the UI)
  let body = {};
  try { body = await req.json(); } catch { /* not JSON — direct HTTP call */ }

  const workflowSecret = secrets.get("REPORT_EMAIL_SECRET");
  const hasValidSecret = workflowSecret && body.secret === workflowSecret;

  let isAdmin = false;
  if (!hasValidSecret) {
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch { isAdmin = false; }
  }

  if (!hasValidSecret && !isAdmin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date().toISOString();
    const pending = await base44.asServiceRole.entities.ScheduledReport.filter({
      status: 'pending',
      scheduled_send_at: { $lte: now }
    });

    if (pending.length === 0) {
      return Response.json({ processed: 0, failed: 0 });
    }

    // Fetch vehicles and employees for label resolution
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const employees = await base44.asServiceRole.entities.Employee.list();
    const vehicleMap = new Map(vehicles.map(v => [v.id, v]));
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    let processed = 0;
    let failed = 0;

    for (const report of pending) {
      try {
        // Fetch trips sorted by started_at; high limit to cover the week
        const allTrips = await base44.asServiceRole.entities.Trip.list('-started_at', 5000);
        const weekTrips = allTrips.filter(t => {
          const ts = t.started_at || t.created_date;
          if (!ts) return false;
          return ts >= report.week_start_iso && ts <= report.week_end_iso;
        });

        const rows = weekTrips.map(trip => {
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
            distance: trip.distance_km,
            duration: trip.duration_minutes,
          };
        });

        const totalDistance = rows.reduce((s, r) => s + (Number(r.distance) || 0), 0);
        const totalMinutes = rows.reduce((s, r) => s + (Number(r.duration) || 0), 0);

        const subject = `Weekly Trip Report – ${report.week_label}`;
        const emailBody = buildEmailBody(rows, report.week_label, totalDistance, totalMinutes);

        await base44.integrations.Core.SendEmail({
          to: report.recipient_email,
          subject,
          body: emailBody,
        });

        await base44.asServiceRole.entities.ScheduledReport.update(report.id, {
          status: 'sent',
          sent_at: new Date().toISOString(),
          error_message: null,
        });
        processed++;
      } catch (err) {
        await base44.asServiceRole.entities.ScheduledReport.update(report.id, {
          status: 'failed',
          error_message: String(err?.message || err).slice(0, 500),
        });
        failed++;
      }
    }

    return Response.json({ processed, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(mins) {
  if (mins == null || isNaN(mins)) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      timeZone: 'Asia/Dubai',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function buildEmailBody(rows, weekLabel, totalDistance, totalMinutes) {
  const rowsHtml = rows.length === 0
    ? '<tr><td colspan="5" style="padding:12px;text-align:center;color:#888;">No trips in this week.</td></tr>'
    : rows.map(r => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;font-family:monospace;">${escapeHtml(r.tripNumber)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.employee)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.vehicle)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:nowrap;">${formatDate(r.start)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${r.distance != null ? Number(r.distance).toFixed(1) : '—'}</td>
      </tr>`).join('');

  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;margin:0 auto;color:#333;">
  <h2 style="color:#db7116;margin-bottom:4px;">Weekly Trip Report</h2>
  <p style="color:#666;margin:0 0 8px;">Week: <strong>${escapeHtml(weekLabel)}</strong></p>
  <p style="color:#666;margin:0 0 16px;">${rows.length} trip(s) &bull; Total distance: ${totalDistance.toFixed(1)} km &bull; Total duration: ${formatDuration(totalMinutes)}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#db7116;color:#fff;">
        <th style="padding:8px 10px;text-align:left;">Trip #</th>
        <th style="padding:8px 10px;text-align:left;">Employee</th>
        <th style="padding:8px 10px;text-align:left;">Vehicle</th>
        <th style="padding:8px 10px;text-align:left;">Start</th>
        <th style="padding:8px 10px;text-align:right;">Distance (km)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <p style="color:#aaa;font-size:11px;margin-top:20px;">This report was scheduled and sent automatically by Kannaz.</p>
</div>`;
}