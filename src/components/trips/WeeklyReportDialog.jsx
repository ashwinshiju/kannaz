import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FileText, Download, Loader2, Mail, Clock, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import moment from 'moment';
import { filterTripsByWeek, buildReportRows, getWeekTotals, downloadCSV, downloadPDF } from '@/utils/weeklyTripReport';

const TZ = 240; // Asia/Dubai

export default function WeeklyReportDialog({ open, onOpenChange }) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week
  const [generating, setGenerating] = useState(null); // 'pdf' | 'csv' | null
  const [emailRecipient, setEmailRecipient] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const weekStart = useMemo(
    () => moment().utcOffset(TZ).startOf('isoWeek').add(weekOffset, 'weeks'),
    [weekOffset]
  );
  const weekEnd = useMemo(() => weekStart.clone().endOf('isoWeek'), [weekStart]);
  const rangeLabel = `${weekStart.format('MMM DD')} – ${weekEnd.format('MMM DD, YYYY')}`;

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: ['trips', 'weekly-report', weekOffset],
    queryFn: () => base44.entities.Trip.list(),
    enabled: open,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list().catch(() => []),
    enabled: open,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list().catch(() => []),
    enabled: open,
  });

  const vehicleMap = useMemo(() => {
    const m = new Map();
    vehicles.forEach((v) => m.set(v.id, v));
    return m;
  }, [vehicles]);

  const employeeMap = useMemo(() => {
    const m = new Map();
    employees.forEach((e) => m.set(e.id, e));
    return m;
  }, [employees]);

  const weekTrips = useMemo(
    () => filterTripsByWeek(trips, weekStart, weekEnd),
    [trips, weekStart, weekEnd]
  );
  const rows = useMemo(
    () => buildReportRows(weekTrips, vehicleMap, employeeMap),
    [weekTrips, vehicleMap, employeeMap]
  );
  const totals = useMemo(() => getWeekTotals(rows), [rows]);

  const handleDownload = async (format) => {
    setGenerating(format);
    // Small delay so the loading state is visible even for fast generation.
    await new Promise((r) => setTimeout(r, 100));
    try {
      const generatedAt = moment().utcOffset(TZ).format('MMM DD, YYYY HH:mm');
      if (format === 'pdf') {
        downloadPDF(rows, weekStart, weekEnd, totals, generatedAt);
      } else {
        downloadCSV(rows, weekStart, weekEnd, totals);
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleSchedule = async () => {
    if (!emailRecipient.trim() || !scheduledTime) return;
    setScheduling(true);
    setScheduled(false);
    try {
      await base44.entities.ScheduledReport.create({
        recipient_email: emailRecipient.trim(),
        week_start_iso: weekStart.toISOString(),
        week_end_iso: weekEnd.toISOString(),
        week_label: rangeLabel,
        scheduled_send_at: new Date(scheduledTime).toISOString(),
        status: 'pending',
      });
      setScheduled(true);
      setEmailRecipient('');
      setScheduledTime('');
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Weekly Trip Report
          </DialogTitle>
          <DialogDescription>
            Download a report of all trips started within the selected week.
          </DialogDescription>
        </DialogHeader>

        {/* Week selector */}
        <div className="flex items-center justify-between gap-2 py-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center flex-1">
            <div className="text-sm font-semibold">{rangeLabel}</div>
            <div className="text-xs text-muted-foreground">
              {weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `${weekOffset < 0 ? '' : '+'}${weekOffset} week${Math.abs(weekOffset) === 1 ? '' : 's'}`}
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex justify-center -mt-1 mb-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
            Jump to this week
          </Button>
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-border bg-muted/40 p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xl font-bold text-primary">{tripsLoading ? '…' : totals.count}</div>
            <div className="text-xs text-muted-foreground">Trips</div>
          </div>
          <div>
            <div className="text-xl font-bold text-primary">{tripsLoading ? '…' : totals.distance}</div>
            <div className="text-xs text-muted-foreground">Total km</div>
          </div>
          <div>
            <div className="text-xl font-bold text-primary">{tripsLoading ? '…' : totals.duration}</div>
            <div className="text-xs text-muted-foreground">Total duration</div>
          </div>
        </div>

        {/* Preview */}
        <div className="max-h-48 overflow-y-auto scrollbar-thin rounded-lg border border-border">
          {tripsLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading trips…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No trips in this week.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-2 font-medium">Trip #</th>
                  <th className="p-2 font-medium">Employee</th>
                  <th className="p-2 font-medium">Vehicle</th>
                  <th className="p-2 font-medium">Start</th>
                  <th className="p-2 font-medium text-right">Dist.</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="p-2 font-mono">{r.tripNumber}</td>
                    <td className="p-2">{r.employee}</td>
                    <td className="p-2">{r.vehicle}</td>
                    <td className="p-2 whitespace-nowrap">{r.startDateTime}</td>
                    <td className="p-2 text-right font-mono">{r.distance != null ? Number(r.distance).toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {rows.length > 50 && (
          <p className="text-xs text-muted-foreground">Showing first 50 of {rows.length} trips. All trips included in the download.</p>
        )}

        {/* Download buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1 gap-2"
            onClick={() => handleDownload('pdf')}
            disabled={generating !== null || rows.length === 0}
          >
            {generating === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => handleDownload('csv')}
            disabled={generating !== null || rows.length === 0}
          >
            {generating === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download CSV
          </Button>
        </div>

        {/* Schedule Email */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="w-4 h-4 text-primary" />
            Schedule Email
          </div>
          <p className="text-xs text-muted-foreground">
            Send this report to a registered app user at a chosen time. Emails can only be delivered to registered Kannaz users.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="report-email" className="text-xs">Recipient email</Label>
              <Input
                id="report-email"
                type="email"
                placeholder="name@company.com"
                value={emailRecipient}
                onChange={(e) => { setEmailRecipient(e.target.value); setScheduled(false); }}
                disabled={scheduling}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="report-time" className="text-xs">Send at</Label>
              <Input
                id="report-time"
                type="datetime-local"
                value={scheduledTime}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => { setScheduledTime(e.target.value); setScheduled(false); }}
                disabled={scheduling}
              />
            </div>
          </div>
          {scheduled && (
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Report scheduled — it will be emailed within 15 minutes of the chosen time.
            </p>
          )}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleSchedule}
            disabled={scheduling || !emailRecipient.trim() || !scheduledTime || rows.length === 0}
          >
            {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : scheduled ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4" />}
            {scheduled ? 'Email Scheduled' : 'Schedule Email'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}