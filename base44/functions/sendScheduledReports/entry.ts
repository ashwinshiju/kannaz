import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { buildReportRows, getTotals, buildEmailBody } from '../../shared/reportEmail.ts';

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