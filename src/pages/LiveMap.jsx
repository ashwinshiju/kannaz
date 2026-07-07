import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MapPin, Car, Gauge, Navigation, Clock, Radio, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StatusBadge from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';

const MOCK_POSITIONS = [
  { id: 1, name: 'Toyota Camry', reg: 'ABC-1234', driver: 'John Smith', status: 'moving', speed: 65, lat: 40.7128, lng: -74.006, heading: 45 },
  { id: 2, name: 'Honda Civic', reg: 'DEF-5678', driver: 'Jane Doe', status: 'idle', speed: 0, lat: 40.7589, lng: -73.9851, heading: 180 },
  { id: 3, name: 'Ford F-150', reg: 'GHI-9012', driver: 'Bob Wilson', status: 'moving', speed: 42, lat: 40.7484, lng: -73.9857, heading: 270 },
  { id: 4, name: 'Chevy Malibu', reg: 'JKL-3456', driver: 'Alice Brown', status: 'offline', speed: 0, lat: 40.7282, lng: -73.7949, heading: 0 },
  { id: 5, name: 'Tesla Model 3', reg: 'MNO-7890', driver: 'Chris Lee', status: 'moving', speed: 78, lat: 40.6892, lng: -74.0445, heading: 90 },
];

const statusColors = { moving: 'bg-emerald-500', idle: 'bg-amber-500', offline: 'bg-gray-400' };
const statusLabels = { moving: 'Moving', idle: 'Idle', offline: 'Offline' };

export default function LiveMap() {
  const [vehicles, setVehicles] = useState(MOCK_POSITIONS);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [playbackActive, setPlaybackActive] = useState(false);

  const filtered = filter === 'all' ? vehicles : vehicles.filter(v => v.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Fleet Map</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time vehicle tracking (simulated)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-xs">
            {Object.entries(statusLabels).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", statusColors[key])} />
                {label} ({vehicles.filter(v => v.status === key).length})
              </span>
            ))}
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vehicles</SelectItem>
              <SelectItem value="moving">Moving</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map Area */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border overflow-hidden" style={{ minHeight: 500 }}>
          <div className="relative w-full h-full min-h-[500px] bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 flex items-center justify-center">
            {/* Simulated Map Grid */}
            <div className="absolute inset-0 opacity-10">
              {Array.from({ length: 20 }).map((_, i) => (
                <React.Fragment key={i}>
                  <div className="absolute border-t border-foreground/20" style={{ top: `${i * 5}%`, left: 0, right: 0 }} />
                  <div className="absolute border-l border-foreground/20" style={{ left: `${i * 5}%`, top: 0, bottom: 0 }} />
                </React.Fragment>
              ))}
            </div>

            {/* Vehicle Markers */}
            {filtered.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className={cn(
                  "absolute flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shadow-lg transition-transform hover:scale-110 cursor-pointer",
                  selected?.id === v.id ? "ring-2 ring-primary scale-110" : "",
                  v.status === 'moving' ? "bg-emerald-500 text-white" :
                  v.status === 'idle' ? "bg-amber-500 text-white" : "bg-gray-400 text-white"
                )}
                style={{
                  top: `${15 + (i * 15) % 70}%`,
                  left: `${10 + (i * 20) % 75}%`,
                }}
              >
                <Car className="w-3 h-3" />
                {v.reg}
              </button>
            ))}

            <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-muted-foreground">
              Map provider placeholder • Supports Mapbox / Google Maps / Azure Maps
            </div>
          </div>
        </div>

        {/* Vehicle List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Vehicles ({filtered.length})</h3>
          <div className="space-y-2 max-h-[460px] overflow-y-auto scrollbar-thin">
            {filtered.map(v => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className={cn(
                  "w-full text-left bg-card rounded-lg border border-border p-3 hover:shadow-md transition-all",
                  selected?.id === v.id && "ring-2 ring-primary"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{v.name}</span>
                  <span className={cn("w-2 h-2 rounded-full", statusColors[v.status])} />
                </div>
                <p className="text-xs text-muted-foreground">{v.reg} • {v.driver}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Gauge className="w-3 h-3" /> {v.speed} km/h</span>
                  <span className="capitalize">{v.status}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Playback Controls */}
          <div className="bg-card rounded-lg border border-border p-3">
            <h4 className="text-xs font-semibold mb-2">Trip Playback</h4>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"><SkipBack className="w-3 h-3" /></Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setPlaybackActive(!playbackActive)}>
                {playbackActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"><SkipForward className="w-3 h-3" /></Button>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: playbackActive ? '45%' : '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Selected Vehicle Detail */}
      {selected && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", statusColors[selected.status])}>
                <Car className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">{selected.name} ({selected.reg})</h3>
                <p className="text-sm text-muted-foreground">Driver: {selected.driver}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="font-semibold">{selected.speed} km/h</p>
                <p className="text-xs text-muted-foreground">Speed</p>
              </div>
              <div className="text-center">
                <p className="font-semibold">{selected.lat.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">Latitude</p>
              </div>
              <div className="text-center">
                <p className="font-semibold">{selected.lng.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">Longitude</p>
              </div>
              <div className="text-center">
                <p className="font-semibold">{selected.heading}°</p>
                <p className="text-xs text-muted-foreground">Heading</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}