import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildReportRows, getTotals, buildEmailBody } from '../../shared/reportEmail.ts';

export default async function(req) {
  const base44 = createClientFromRequest(req);

  let body = {};
  try { body = await req.json(); } catch { /* not JSON */ }

  const { recipient_email, start_iso, end_iso, range_label } = body;

  // Auth: platform admin OR employee with manager/admin role
  let authorized = false;
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role === 'admin') {
      authorized = true;
    } else {
      const employees = await base44.asServiceRole.entities.Employee.list();
      const emp = employees.find((e) => e.email === user.email);
      authorized = emp?.role === 'admin' || emp?.role === 'manager';
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!authorized) {
    return Response.json({ error: 'Forbidden — managers and admins only' }, { status: 403 });
  }

  if (!recipient_email || !range_label) {
    return Response.json({ error: 'recipient_email and range_label are required' }, { status: 400 });
  }

  try {
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const employees = await base44.asServiceRole.entities.Employee.list();
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const allTrips = await base44.asServiceRole.entities.Trip.list('-started_at', 5000);
    const rangeTrips = (!start_iso && !end_iso)
      ? allTrips
      : allTrips.filter((t) => {
          const ts = t.started_at || t.created_date;
          if (!ts) return false;
          if (start_iso && ts < start_iso) return false;
          if (end_iso && ts > end_iso) return false;
          return true;
        });

    const rows = buildReportRows(rangeTrips, vehicleMap, employeeMap);
    const { totalDistance, totalMinutes } = getTotals(rows);

    const subject = `Trip Report – ${range_label}`;
    const emailBody = buildEmailBody(rows, range_label, totalDistance, totalMinutes);

    await base44.integrations.Core.SendEmail({
      to: recipient_email,
      subject,
      body: emailBody,
    });

    return Response.json({ sent: true, trips: rows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}