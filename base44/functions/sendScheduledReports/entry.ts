import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildReportRows, getTotals, buildEmailBody } from '../../shared/reportEmail.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req);

  // --- Authorization ---
  // Scheduled workflows invoke this function with no user session (per Base44
  // docs, scheduled-task functions have no authenticated user and use
  // asServiceRole). Secrets are read inside the function, never passed as
  // workflow args. Manual UI calls carry a user JWT — require admin for those.
  let user = null;
  try { user = await base44.auth.me(); } catch { /* no session — workflow path */ }
  if (user && user.role !== 'admin') {
    return Response.json({ error: "Forbidden" }, { status: 403 });
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

    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const employees = await base44.asServiceRole.entities.Employee.list();
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    let processed = 0;
    let failed = 0;

    for (const report of pending) {
      try {
        const allTrips = await base44.asServiceRole.entities.Trip.list('-started_at', 5000);
        const weekTrips = allTrips.filter((t) => {
          const ts = t.started_at || t.created_date;
          if (!ts) return false;
          return ts >= report.week_start_iso && ts <= report.week_end_iso;
        });

        const rows = buildReportRows(weekTrips, vehicleMap, employeeMap);
        const { totalDistance, totalMinutes } = getTotals(rows);

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