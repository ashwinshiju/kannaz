import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Wrench, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function MaintenanceAlertPopup() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const loadAlerts = async () => {
    try {
      const notifs = await base44.entities.Notification.filter({ type: 'maintenance', is_read: false });
      setAlerts(notifs);
      if (notifs.length > 0 && !dismissed) {
        setOpen(true);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const dismissAll = async () => {
    for (const n of alerts) {
      await base44.entities.Notification.update(n.id, { is_read: true });
    }
    setAlerts([]);
    setOpen(false);
    setDismissed(true);
  };

  const dismissOne = async (id) => {
    await base44.entities.Notification.update(id, { is_read: true });
    const remaining = alerts.filter(a => a.id !== id);
    setAlerts(remaining);
    if (remaining.length === 0) setOpen(false);
  };

  if (alerts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setDismissed(true); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-amber-600" />
            </div>
            Maintenance Alerts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => dismissOne(alert.id)}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={dismissAll}>
            Dismiss All
          </Button>
          <Button asChild size="sm" className="gap-1">
            <Link to="/maintenance" onClick={() => setOpen(false)}>
              View Maintenance <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}