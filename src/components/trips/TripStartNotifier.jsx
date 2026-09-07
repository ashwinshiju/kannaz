import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Car, X, MapPin } from 'lucide-react';

const AUTO_DISMISS_MS = 8000;

export default function TripStartNotifier() {
  const { user, isAuthenticated } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [popups, setPopups] = useState([]);
  const tripStatusRef = useRef({});
  const selfIdRef = useRef(null);
  const timersRef = useRef({});

  // Only enable for admins and managers (Employee role matched by email)
  useEffect(() => {
    let cancelled = false;
    selfIdRef.current = user?.id || null;
    if (!isAuthenticated || !user?.email) {
      setEnabled(false);
      return;
    }
    base44.entities.Employee.filter({ email: user.email }).then(emps => {
      if (cancelled) return;
      const role = emps[0]?.role;
      setEnabled(role === 'admin' || role === 'manager');
    }).catch(() => { if (!cancelled) setEnabled(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.email, user?.id]);

  useEffect(() => {
    if (!enabled) return;

    const dismiss = (popupId) => {
      clearTimeout(timersRef.current[popupId]);
      delete timersRef.current[popupId];
      setPopups(prev => prev.filter(p => p.id !== popupId));
    };

    const pushPopup = (trip) => {
      const popupId = `${trip.id}-${Date.now()}`;
      setPopups(prev => [...prev.slice(-3), { id: popupId, trip }]);
      timersRef.current[popupId] = setTimeout(() => dismiss(popupId), AUTO_DISMISS_MS);
    };

    const handleEvent = (event) => {
      const { type, data } = event || {};
      if (!data?.id) return;

      const tripId = data.id;
      const prevStatus = tripStatusRef.current[tripId];
      tripStatusRef.current[tripId] = data.status;

      // Skip the user's own trips
      if (selfIdRef.current && data.created_by_id === selfIdRef.current) return;

      const isRelevantStatus = ['created', 'in_progress'].includes(data.status);
      const justCreated = type === 'create' && isRelevantStatus;
      const justStarted = type === 'update' && data.status === 'in_progress' && prevStatus !== 'in_progress' && prevStatus !== undefined;
      if (justCreated || justStarted) {
        pushPopup(data);
      }
    };

    const unsubscribe = base44.entities.Trip.subscribe(handleEvent);
    return () => {
      unsubscribe();
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, [enabled]);

  const dismiss = (popupId) => {
    clearTimeout(timersRef.current[popupId]);
    delete timersRef.current[popupId];
    setPopups(prev => prev.filter(p => p.id !== popupId));
  };

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-80 pointer-events-none safe-top">
      <AnimatePresence>
        {popups.map(({ id, trip }) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto rounded-xl border border-border bg-card shadow-lg p-3"
          >
            <div className="flex items-start gap-2.5">
              <div className="rounded-full bg-primary/10 p-2 shrink-0">
                <Car className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  {trip.employee_name || 'Someone'} started a trip
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trip.vehicle_name}{trip.started_at ? ` · ${new Date(trip.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
                {(trip.start_location || trip.end_location) && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{trip.start_location || '—'} → {trip.end_location || '—'}</span>
                  </p>
                )}
                <Link to={`/live-map?highlight=${trip.id}`} onClick={() => dismiss(id)} className="text-xs font-medium text-primary hover:underline mt-1.5 inline-block">
                  View on Live Map
                </Link>
              </div>
              <button onClick={() => dismiss(id)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}