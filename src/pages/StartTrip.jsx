import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { GPSService, GPS_DEFAULTS } from '@/services/GPSService';
import { ChevronLeft, MapPin, Loader2, AlertTriangle, Car, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MobileSelect from '@/components/shared/MobileSelect';
import { useToast } from '@/components/ui/use-toast';

const VEHICLES_QUERY_KEY = ['vehicles'];
const TRIPS_QUERY_KEY = ['trips'];

const PURPOSE_OPTIONS = [
  { value: 'official', label: 'Official' },
  { value: 'personal', label: 'Personal' },
  { value: 'maintenance', label: 'Maintenance' },
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function StartTrip() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Live query against the Vehicles entity — same entity used on the Vehicles
  // management page (base44.entities.Vehicle). Filtered to status === 'available'.
  const { data: availableVehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles', 'available'],
    queryFn: () => base44.entities.Vehicle.filter({ status: 'available' }),
  });

  const gpsServiceRef = useRef(null);
  if (!gpsServiceRef.current) {
    gpsServiceRef.current = new GPSService();
  }

  const [vehicleId, setVehicleId] = useState('');
  const [purpose, setPurpose] = useState('official');
  const [startOdometer, setStartOdometer] = useState('');
  const [odometerLocked, setOdometerLocked] = useState(false);
  const [odometerManuallyEntered, setOdometerManuallyEntered] = useState(false);
  const [startLat, setStartLat] = useState('');
  const [startLng, setStartLng] = useState('');
  const [notes, setNotes] = useState('');
  const [gpsMetadata, setGpsMetadata] = useState(null);
  const [gpsWarning, setGpsWarning] = useState(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const vehicleOptions = availableVehicles.map(v => ({
    value: v.id,
    label: `${v.reg_no} — ${v.make} ${v.model}`.trim(),
  }));

  // Auto-fetch the vehicle's last known odometer reading when a vehicle is
  // selected. The chain reads from live Trip records (most recently completed
  // trip's end_odometer) and falls back to the Vehicle entity's
  // current_odometer field — no hardcoded values.
  const { data: odometerData, isLoading: odometerLoading } = useQuery({
    queryKey: ['vehicle-odometer', vehicleId],
    queryFn: async () => {
      const vehicle = await base44.entities.Vehicle.get(vehicleId);
      // Fetch recent trips for this vehicle, sorted by most recent first.
      const trips = await base44.entities.Trip.filter(
        { vehicle_id: vehicleId },
        '-created_date',
        50
      );
      const completedTrips = trips.filter(
        (t) => t.status === 'completed' && t.end_odometer != null
      );
      const lastEndOdometer = completedTrips.length > 0 ? completedTrips[0].end_odometer : null;
      return {
        lastTripEndOdometer: lastEndOdometer,
        vehicleOdometer: vehicle.current_odometer,
      };
    },
    enabled: !!vehicleId,
  });

  // Pre-fill the start odometer when data arrives.
  useEffect(() => {
    if (!odometerData) {
      setStartOdometer('');
      setOdometerLocked(false);
      setOdometerManuallyEntered(false);
      return;
    }
    const { lastTripEndOdometer, vehicleOdometer } = odometerData;
    if (lastTripEndOdometer != null) {
      setStartOdometer(String(lastTripEndOdometer));
      setOdometerLocked(true);
      setOdometerManuallyEntered(false);
    } else if (vehicleOdometer != null) {
      setStartOdometer(String(vehicleOdometer));
      setOdometerLocked(true);
      setOdometerManuallyEntered(false);
    } else {
      // No prior odometer value — allow manual entry as fallback.
      setStartOdometer('');
      setOdometerLocked(false);
      setOdometerManuallyEntered(true);
    }
  }, [odometerData]);

  const handleCaptureGPS = async () => {
    setGpsCapturing(true);
    setGpsWarning(null);
    setGpsMetadata(null);

    // Reuse the single existing GPSService — its captureSinglePoint method
    // acquires one raw fix and pipes it through the full validation pipeline
    // (coordinate bounds, null-island, jump detection, spoofing, trust score).
    // No parallel/duplicate geolocation logic is introduced here.
    const result = await gpsServiceRef.current.captureSinglePoint();

    if (result.error || !result.point) {
      setGpsWarning(result.error || 'Failed to capture GPS coordinates');
      setGpsCapturing(false);
      return;
    }

    const point = result.point;
    setStartLat(point.lat.toFixed(6));
    setStartLng(point.lng.toFixed(6));
    setGpsMetadata({
      trustScore: point.trustScore,
      confidence: point.confidence,
      accuracy: point.accuracy,
      isMocked: point.isMocked,
      spoofed: point.spoofed,
      spoofReasons: point.spoofReasons,
      isJump: point.isJump,
      timestamp: point.timestamp,
    });

    // Surface a warning when the service flags the reading as low quality,
    // using the service's own confidence threshold (derived from
    // GPS_DEFAULTS.maxAccuracyMeters) — no new threshold value introduced.
    if (point.confidence === 'low' || point.isMocked || point.spoofed || point.isJump) {
      const reasons = [];
      if (point.confidence === 'low') reasons.push(`Low accuracy (${point.accuracy != null ? Math.round(point.accuracy) : '?'}m)`);
      if (point.isMocked) reasons.push('Mocked location flag detected');
      if (point.spoofed) reasons.push(`Spoofing detected: ${(point.spoofReasons || []).join(', ')}`);
      if (point.isJump) reasons.push('GPS jump anomaly detected');
      setGpsWarning(`GPS reading flagged (trust score: ${point.trustScore}/100) — ${reasons.join('; ')}`);
    }

    setGpsCapturing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!vehicleId) {
      toast({ title: 'Please select a vehicle', variant: 'destructive' });
      return;
    }
    if (!startLat || !startLng) {
      toast({ title: 'Please capture GPS coordinates', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      // Stale-vehicle check: re-fetch the selected vehicle to confirm it is
      // still available between when the dropdown was loaded and now.
      const vehicle = await base44.entities.Vehicle.get(vehicleId);
      if (vehicle.status !== 'available') {
        toast({
          title: 'Vehicle no longer available',
          description: 'This vehicle was assigned to another trip. Please select a different vehicle.',
          variant: 'destructive',
        });
        setVehicleId('');
        setSubmitting(false);
        queryClient.invalidateQueries({ queryKey: ['vehicles', 'available'] });
        return;
      }

      const tripNumber = `TRP-${String(Date.now()).slice(-6)}`;
      const now = new Date().toISOString();

      const tripData = {
        trip_number: tripNumber,
        employee_id: user?.id || '',
        employee_name: user?.full_name || 'Unknown',
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,
        department: vehicle.assigned_department || '',
        start_location: `GPS: ${parseFloat(startLat).toFixed(6)}, ${parseFloat(startLng).toFixed(6)}`,
        end_location: '',
        start_lat: parseFloat(startLat),
        start_lng: parseFloat(startLng),
        start_trust_score: gpsMetadata?.trustScore ?? null,
        start_gps_metadata: gpsMetadata ? JSON.stringify(gpsMetadata) : '',
        purpose,
        status: 'in_progress',
        start_odometer: startOdometer ? parseFloat(startOdometer) : null,
        odometer_manually_entered: odometerManuallyEntered,
        started_at: now,
        notes: notes || '',
      };

      // Create the trip with the vehicle's record ID as a foreign-key reference.
      const createdTrip = await base44.entities.Trip.create(tripData);

      // Update the vehicle's availability status to "in_use" so it no longer
      // appears as available until the trip ends.
      await base44.entities.Vehicle.update(vehicle.id, { status: 'in_use' });

      // Invalidate both caches so the Trips list and Vehicles list reflect changes.
      queryClient.invalidateQueries({ queryKey: TRIPS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'available'] });

      toast({ title: 'Trip started successfully' });
      navigate('/trips');
    } catch (error) {
      toast({
        title: 'Failed to start trip',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-start justify-center py-6">
      <div className="w-full max-w-lg">
        {/* Header: back link + avatar */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/trips')}
            className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to trips
          </button>
          {user && (
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {getInitials(user.full_name)}
            </div>
          )}
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
          <h1 className="text-2xl font-bold font-heading">Start a trip</h1>

          {/* Vehicle dropdown */}
          <div className="space-y-1.5">
            <Label>Vehicle</Label>
            {vehiclesLoading ? (
              <div className="flex items-center gap-2 h-9 px-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading vehicles...
              </div>
            ) : availableVehicles.length === 0 ? (
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/30 text-sm text-muted-foreground">
                <Car className="w-4 h-4" />
                No vehicles available
              </div>
            ) : (
              <MobileSelect
                value={vehicleId}
                onValueChange={setVehicleId}
                options={vehicleOptions}
                placeholder="Choose an available vehicle"
              />
            )}
          </div>

          {/* Purpose + Odometer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <MobileSelect
                value={purpose}
                onValueChange={setPurpose}
                options={PURPOSE_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_odometer">
                Start odometer (km)
                {odometerLocked && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground font-normal">
                    <Lock className="w-3 h-3" /> auto
                  </span>
                )}
              </Label>
              <Input
                id="start_odometer"
                type="number"
                step="0.01"
                value={startOdometer}
                onChange={e => setStartOdometer(e.target.value)}
                placeholder={odometerLocked ? '' : 'Enter odometer (no prior record)'}
                readOnly={odometerLocked}
                disabled={odometerLoading}
                className={odometerLocked ? 'bg-muted/50 cursor-not-allowed' : ''}
              />
              {odometerManuallyEntered && (
                <p className="text-xs text-muted-foreground">
                  No prior odometer on record — manually entered value will be flagged.
                </p>
              )}
            </div>
          </div>

          {/* GPS section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Start location (GPS)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCaptureGPS}
                disabled={gpsCapturing}
                className="gap-1.5"
              >
                {gpsCapturing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                {gpsCapturing ? 'Capturing...' : 'Capture GPS'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="text"
                value={startLat}
                onChange={e => setStartLat(e.target.value)}
                placeholder="Latitude"
                readOnly
              />
              <Input
                type="text"
                value={startLng}
                onChange={e => setStartLng(e.target.value)}
                placeholder="Longitude"
                readOnly
              />
            </div>
            {gpsWarning && (
              <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-md p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{gpsWarning}</span>
              </div>
            )}
            {gpsMetadata && !gpsWarning && (
              <p className="text-xs text-muted-foreground">
                Trust score: {gpsMetadata.trustScore}/100 · Accuracy: {gpsMetadata.accuracy != null ? `${Math.round(gpsMetadata.accuracy)}m` : '—'}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional trip notes..."
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !vehicleId || !startLat || !startLng || availableVehicles.length === 0}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting trip...
              </>
            ) : (
              'Start trip'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}