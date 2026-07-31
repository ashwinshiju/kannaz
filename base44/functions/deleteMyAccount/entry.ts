import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the authenticated user's own identity — server-side only — so a
    // caller can never target another user's records.
    const userId = user.id;
    const userEmail = user.email;
    const userName = user.full_name || 'Unknown';

    await Promise.all([
      base44.asServiceRole.entities.Trip.deleteMany({ employee_id: userId }),
      base44.asServiceRole.entities.FuelRecord.deleteMany({ employee_id: userId }),
      base44.asServiceRole.entities.Notification.deleteMany({ target_user_id: userId }),
      base44.asServiceRole.entities.AuditLog.deleteMany({ user_email: userEmail }),
    ]);

    // Log the deletion after cleanup so it survives the AuditLog purge.
    await base44.asServiceRole.entities.AuditLog.create({
      user_name: userName,
      user_email: userEmail,
      action: 'delete',
      module: 'Account',
      entity_type: 'User',
      details: 'User initiated account deletion — all associated data removed',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}