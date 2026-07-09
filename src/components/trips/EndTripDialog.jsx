import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { GPSService, calculateDistance } from '@/services/GPSService';
import { MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import TripSummaryCard from '@/components/trips/TripSummaryCard';

export default function EndTripDialog({ trip, open, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const gpsServiceRef = useRef(null);
  if (!gpsServiceRef.current) gpsServiceRef.current = new GPSService();

  const [endOdometer, setEndOdometer] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLng, setEndLng] = useState('');
  const [gpsMetadata, setGpsMetadata] = useState(null);
  const [gpsWarning, setGpsWarning] = useState(null);
  const [gpsCapturing, setGpsCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [odometerError, setOdometerError] = useState(null);

  // Reset all state when the dialog opens for a new trip.
  useEffect(() => {
    if (open) {
      setEndOdometer('');
      setEndLat('');
      setEndLng('');
      setGpsMetadata(null);
      setGpsWarning(null);
      setGpsCapturing(false);
      setSubmitting(false);
      setOdometerError(null);
    }
  }, [open, trip?.id]);

  // Auto-capture GPS when the dialog opens — the user only needs to enter the
  // final odometer reading.
  useEffect(() => {
    if (open && !gpsCapturing && !gpsMetadata) {
      handleCaptureGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trip?.id]);

  const startOdo = trip?.start_odometer;

  const validateOdometer = (val) => {
    if (val === '' || val == null) {
      setOdometerError('End odometer is required');
      return false;
    }
    const num = parseFloat(val);
    if (isNaN(num)) {
      setOdometerError('End odometer must be a valid number');
      return false;
    }
    if (startOdo != null && num < startOdo) {
      setOdometerError(`End odometer (${num} km) must be ≥ start odometer (${startOdo} km)`);
      return false;
    }
    setOdometerError(null);
    return true;
  };

  const handleOdometerChange = (e) => {
    const val = e.target.value;
    setEndOdometer(val);
    if (odometerError) validateOdometer(val);
  };

  const handleCaptureGPS = async () => {
    setGpsCapturing(true);
    setGpsWarning(null);
    setGpsMetadata(null);

    // Reuse the same GPSService.captureSinglePoint used on Start Trip —
    // no new/duplicate GPS logic.
    const result = await gpsServiceRef.current.captureSinglePoint();

    if (result.error || !result.point) {
      setGpsWarning(result.error || 'Failed to capture GPS coordinates');
      setGpsCapturing(false);
      return;
    }

    const point = result.point;
    setEndLat(point.lat.toFixed(6));
    setEndLng(point.lng.toFixed(6));
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

    if (!validateOdometer(endOdometer)) return;
    if (!endLat || !endLng) {
      toast({ title: 'Please capture end GPS coordinates', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      const endOdoNum = parseFloat(endOdometer);
      const distance = startOdo != null ? Math.round((endOdoNum - startOdo) * 100) / 100 : null;

      // --- Compute actual tracked distance from persisted GPS points ---
      // Retrieve all tracking-log entries for this trip, ordered by time.
      const trackingPoints = await base44.entities.TripTrackingLog.filter(
        { trip_id: trip.id },
        'created_date',
        1000
      );

      // Filter to valid points only — reuse the same quality criteria
      // applied during tracking (trust score, spoof/jump/mock flags).
      const validPoints = trackingPoints
        .filter((p) => p.is_valid !== false && p.latitude != null && p.longitude != null)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      let trackedDistanceKm = null;
      let lowTrackingData = false;

      if (validPoints.length >= 2) {
        // Sum Haversine distance between each consecutive pair of valid points.
        let totalMeters = 0;
        for (let i = 1; i < validPoints.length; i++) {
          totalMeters += calculateDistance(
            validPoints[i - 1].latitude,
            validPoints[i - 1].longitude,
            validPoints[i].latitude,
            validPoints[i].longitude
          );
        }
        trackedDistanceKm = Math.round((totalMeters / 1000) * 100) / 100;
      } else {
        // Fewer than 2 valid tracked points — fall back to Haversine
        // between start and end coordinates, and flag as low-tracking-data.
        lowTrackingData = true;
        const sLat = trip.start_lat;
        const sLng = trip.start_lng;
        const eLat = parseFloat(endLat);
        const eLng = parseFloat(endLng);
        if (sLat != null && sLng != null) {
          const meters = calculateDistance(sLat, sLng, eLat, eLng);
          trackedDistanceKm = Math.round((meters / 1000) * 100) / 100;
        }
      }

      const updates = {
        status: 'completed',
        completed_at: new Date().toISOString(),
        end_odometer: endOdoNum,
        end_lat: parseFloat(endLat),
        end_lng: parseFloat(endLng),
        end_trust_score: gpsMetadata?.trustScore ?? null,
        end_gps_metadata: gpsMetadata ? JSON.stringify(gpsMetadata) : '',
        end_location: `GPS: ${parseFloat(endLat).toFixed(6)}, ${parseFloat(endLng).toFixed(6)}`,
        distance_km: distance,
        tracked_distance_km: trackedDistanceKm,
        low_tracking_data: lowTrackingData,
      };

      await base44.entities.Trip.update(trip.id, updates);

      // Update the vehicle's current_odometer so the next trip's start
      // odometer auto-fills from this value, and revert status to available.
      if (trip.vehicle_id) {
        await base44.entities.Vehicle.update(trip.vehicle_id, {
          current_odometer: endOdoNum,
          status: 'available',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'available'] });

      toast({ title: 'Trip completed successfully' });
      onClose(false);
    } catch (error) {
      toast({
        title: 'Failed to complete trip',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>End trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Start odometer (read-only context) */}
          <div className="space-y-1.5">
            <Label>Start odometer (km)</Label>
            <Input
              type="text"
              value={startOdo != null ? String(startOdo) : '—'}
              readOnly
              className="bg-muted/50"
            />
          </div>

          {/* End odometer (manual entry required) */}
          <div className="space-y-1.5">
            <Label htmlFor="end_odometer">
              End odometer (km)
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Input
              id="end_odometer"
              type="number"
              step="0.01"
              value={endOdometer}
              onChange={handleOdometerChange}
              onBlur={(e) => validateOdometer(e.target.value)}
              placeholder="Enter final odometer reading"
              required
            />
            {odometerError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {odometerError}
              </p>
            )}
          </div>

          {/* GPS capture */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                End location (GPS)
                <span className="text-destructive ml-0.5">*</span>
              </Label>
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
                value={endLat}
                placeholder="Latitude"
                readOnly
              />
              <Input
                type="text"
                value={endLng}
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

          {/* Live summary card — shows calculated distance once end odometer is entered */}
          {endOdometer && !odometerError && (
            <TripSummaryCard
              trip={{
                ...trip,
                end_odometer: parseFloat(endOdometer) || null,
                distance_km:
                  startOdo != null && endOdometer
                    ? Math.round((parseFloat(endOdometer) - startOdo) * 100) / 100
                    : null,
                end_trust_score: gpsMetadata?.trustScore ?? null,
              }}
            />
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={submitting || !endOdometer || !!odometerError || !endLat || !endLng}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Completing...
                </>
              ) : (
                'Complete trip'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}