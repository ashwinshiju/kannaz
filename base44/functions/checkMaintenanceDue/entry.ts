import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  const base44 = createClientFromRequest(req);

  // Auth check must run BEFORE the try block so auth failures can't be
  // swallowed by the catch and turned into a 500 that still exposes data.
  let isAuthed = false;
  try {
    isAuthed = await base44.auth.isAuthenticated();
  } catch {
    isAuthed = false;
  }
  if (!isAuthed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vehicles = await base44.asServiceRole.entities.Vehicle.list();
    const existingNotifs = await base44.asServiceRole.entities.Notification.filter({ type: 'maintenance', is_read: false });
    const maintenanceRecords = await base44.asServiceRole.entities.Maintenance.list();

    const BUFFER = 500;
    const INTERVAL = 10000;

    const newNotifications = [];
    const alerts = [];

    for (const vehicle of vehicles) {
      const odometer = vehicle.current_odometer || 0;
      if (odometer <= 0) continue;

      const currentMilestone = Math.floor(odometer / INTERVAL) * INTERVAL;
      const nextMilestone = currentMilestone + INTERVAL;
      const distanceToNext = nextMilestone - odometer;
      const distanceFromLast = odometer - currentMilestone;

      const isApproaching = distanceToNext > 0 && distanceToNext <= BUFFER;
      const justPassed = currentMilestone > 0 && distanceFromLast <= BUFFER;

      if (!isApproaching && !justPassed) continue;

      const alertMilestone = isApproaching ? nextMilestone : currentMilestone;

      // Skip if maintenance already completed near this milestone
      const hasCompletedMaintenance = maintenanceRecords.some(m =>
        m.vehicle_id === vehicle.id &&
        m.status === 'completed' &&
        m.odometer >= alertMilestone - BUFFER &&
        m.odometer <= alertMilestone + BUFFER
      );
      if (hasCompletedMaintenance) continue;

      // Skip if notification already exists for this vehicle + milestone
      const alreadyNotified = existingNotifs.some(n =>
        n.title?.includes(vehicle.name) && n.message?.includes(alertMilestone.toLocaleString())
      );
      if (alreadyNotified) continue;

      const message = isApproaching
        ? `${vehicle.name} (${vehicle.reg_no}) is approaching ${alertMilestone.toLocaleString()} km. Current: ${odometer.toLocaleString()} km. Schedule maintenance soon.`
        : `${vehicle.name} (${vehicle.reg_no}) has crossed ${currentMilestone.toLocaleString()} km. Current: ${odometer.toLocaleString()} km. Maintenance overdue.`;

      newNotifications.push({
        title: `Maintenance Due: ${vehicle.name}`,
        message,
        type: 'maintenance',
        is_read: false,
        link: '/maintenance'
      });

      alerts.push({ vehicle: vehicle.name, reg_no: vehicle.reg_no, odometer, milestone: alertMilestone, isApproaching });
    }

    if (newNotifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(newNotifications);
    }

    return Response.json({ alertsCreated: newNotifications.length, alerts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}