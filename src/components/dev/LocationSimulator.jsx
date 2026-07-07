/**
 * LocationSimulator — dev-only component that feeds synthetic GPS streams
 * into GPSService for QA testing of the Trip Replay Engine and geofence
 * triggers without physically driving.
 *
 * Modes:
 *  - straight_line: steady movement along a line
 *  - circular: constant-radius circular route
 *  - jump:      teleport between far-apart points (speed anomaly)
 *  - jitter:    stationary with small random noise
 *  - tunnel:    regular points, then a signal-loss gap, then resume
 */

import React, { useState, useRef, useEffect } from 'react';
import { GPSService, LOCATION_STATES } from '@/services/GPSService';
import { Play, Pause, Square, Radio, MapPin, Zap, Waves, Circle, Orbit, AlertTriangle, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const SIM_MODES = [
  { value: 'straight_line', label: 'Straight Line', icon: Minus },
  { value: 'circular', label: 'Circular Route', icon: Orbit },
  { value: 'jump', label: 'Jump / Teleport', icon: Zap },
  { value: 'jitter', label: 'Stationary Jitter', icon: Circle },
  { value: 'tunnel', label: 'Tunnel / Signal Loss', icon: Waves },
];

/**
 * Generate a stream of synthetic points for the given mode.
 * @returns {Array<{ lat, lng, accuracy, isMocked, timestamp }>}
 */
export function generateSimStream(mode, opts = {}) {
  const {
    origin = { lat: 40.7128, lng: -74.006 },
    count = 20,
    intervalMs = 1000,
    radius = 200,
  } = opts;

  const points = [];
  const baseTs = Date.now();

  switch (mode) {
    case 'straight_line': {
      for (let i = 0; i < count; i++) {
        points.push({
          lat: origin.lat + (i * 0.0001),
          lng: origin.lng + (i * 0.0001),
          accuracy: 10,
          isMocked: false,
          timestamp: baseTs + i * intervalMs,
        });
      }
      break;
    }
    case 'circular': {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        points.push({
          lat: origin.lat + (radius / 111_000) * Math.cos(angle),
          lng: origin.lng + (radius / 111_000) * Math.sin(angle) / Math.cos((origin.lat * Math.PI) / 180),
          accuracy: 8,
          isMocked: false,
          timestamp: baseTs + i * intervalMs,
        });
      }
      break;
    }
    case 'jump': {
      // Normal movement then sudden teleport ~50km away
      for (let i = 0; i < count; i++) {
        if (i < 5) {
          points.push({ lat: origin.lat + i * 0.0001, lng: origin.lng + i * 0.0001, accuracy: 10, isMocked: false, timestamp: baseTs + i * intervalMs });
        } else if (i === 5) {
          // Teleport — implies impossible speed
          points.push({ lat: origin.lat + 0.5, lng: origin.lng + 0.5, accuracy: 10, isMocked: false, timestamp: baseTs + i * intervalMs });
        } else {
          points.push({ lat: origin.lat + 0.5 + (i - 5) * 0.0001, lng: origin.lng + 0.5 + (i - 5) * 0.0001, accuracy: 10, isMocked: false, timestamp: baseTs + i * intervalMs });
        }
      }
      break;
    }
    case 'jitter': {
      for (let i = 0; i < count; i++) {
        points.push({
          lat: origin.lat + (Math.random() - 0.5) * 0.0002,
          lng: origin.lng + (Math.random() - 0.5) * 0.0002,
          accuracy: 5,
          isMocked: false,
          timestamp: baseTs + i * intervalMs,
        });
      }
      break;
    }
    case 'tunnel': {
      for (let i = 0; i < count; i++) {
        if (i >= 8 && i <= 12) continue; // signal-loss gap
        points.push({
          lat: origin.lat + i * 0.0001,
          lng: origin.lng + i * 0.0001,
          accuracy: 15,
          isMocked: false,
          timestamp: baseTs + i * intervalMs,
        });
      }
      break;
    }
    default:
      break;
  }

  return points;
}

export default function LocationSimulator({ gpsService, geofences = [] }) {
  const [mode, setMode] = useState('straight_line');
  const [running, setRunning] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);
  const [events, setEvents] = useState([]);
  const svcRef = useRef(gpsService || new GPSService());

  useEffect(() => {
    const svc = svcRef.current;
    if (geofences.length) svc.setGeofences(geofences);
    const unsub = svc.subscribe((point, meta) => {
      if (point) setLastPoint(point);
      if (meta.geofenceEvents?.length) {
        setEvents((prev) => [...prev, ...meta.geofenceEvents].slice(-10));
      }
    });
    return () => { unsub(); svc.stopSimulation(); };
  }, [geofences]);

  const handleStart = () => {
    const svc = svcRef.current;
    svc.reset();
    const stream = generateSimStream(mode);
    svc.feedSimulatedStream(stream, 1000);
    setRunning(true);
    setEvents([]);
  };

  const handleStop = () => {
    svcRef.current.stopSimulation();
    setRunning(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Location Simulator</h3>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">DEV ONLY</span>
      </div>

      {/* Mode selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Simulation Mode</Label>
        <Select value={mode} onValueChange={setMode} disabled={running}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SIM_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!running ? (
          <Button size="sm" onClick={handleStart} className="gap-1"><Play className="w-3.5 h-3.5" /> Start Feed</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handleStop} className="gap-1"><Pause className="w-3.5 h-3.5" /> Pause</Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleStop} className="gap-1"><Square className="w-3.5 h-3.5" /> Stop</Button>
      </div>

      {/* Live point info */}
      {lastPoint && (
        <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-xs font-mono">
          <div className="flex justify-between"><span className="text-muted-foreground">Lat/Lng</span><span>{lastPoint.lat.toFixed(4)}, {lastPoint.lng.toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Accuracy</span><span>{lastPoint.accuracy}m</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Confidence</span>
            <span className={cn("font-semibold", lastPoint.confidence === 'low' ? 'text-amber-600' : 'text-emerald-600')}>{lastPoint.confidence}</span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Jump</span>
            <span className={lastPoint.isJump ? 'text-red-600 font-semibold' : ''}>{lastPoint.isJump ? `YES (${lastPoint.impliedSpeedKmh.toFixed(0)} km/h)` : 'no'}</span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Spoofed</span>
            <span className={lastPoint.spoofed ? 'text-red-600 font-semibold' : ''}>{lastPoint.spoofed ? 'YES' : 'no'}</span>
          </div>
          <div className="flex justify-between"><span className="text-muted-foreground">Trust Score</span>
            <span className={cn("font-bold", lastPoint.trustScore >= 70 ? 'text-emerald-600' : lastPoint.trustScore >= 40 ? 'text-amber-600' : 'text-red-600')}>{lastPoint.trustScore}/100</span>
          </div>
          {lastPoint.spoofReasons?.length > 0 && (
            <div className="pt-1 border-t border-border/50">
              {lastPoint.spoofReasons.map((r, i) => (
                <div key={i} className="flex items-start gap-1 text-red-600"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {r}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Geofence events */}
      {events.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs font-semibold">Geofence Events</span>
          {events.map((ev, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded px-2 py-1">
              <MapPin className="w-3 h-3 text-primary" />
              <span className="font-mono">{ev.fenceId}</span>
              <span className={ev.type === 'enter' ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>{ev.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}