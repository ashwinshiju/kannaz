import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download, Loader2, Mail, Send } from 'lucide-react';
import moment from 'moment';
import { filterTripsByWeek, buildReportRows, getWeekTotals, downloadCSV, downloadPDF } from '@/utils/weeklyTripReport';
import { useToast } from '@/components/ui/use-toast';

const TZ = 240; // Asia/Dubai

export default function TripReportDialog({ open, onOpenChange }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allTime, setAllTime] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [emailRecipient, setEmailRecipient] = useState(user?.email || '');
  const [sending, setSending] = useState(false);

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['trips', 'audit-report'],
    queryFn: () => base44.entities.Trip.list('-started_at', 5000),
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

  const vehicleMap = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles]);
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const rangeStart = useMemo(() => {
    if (allTime || !startDate) return null;
    return moment(startDate).utcOffset(TZ).startOf('day');
  }, [allTime, startDate]);
  const rangeEnd = useMemo(() => {
    if (allTime || !endDate) return null;
    return moment(endDate).utcOffset(TZ).endOf('day');
  }, [allTime, endDate]);

  const rangeTrips = useMemo(() => {
    if (allTime || (!rangeStart && !rangeEnd)) return trips;
    return filterTripsByWeek(trips, rangeStart || moment('2000-01-01'), rangeEnd || moment('2100-01-01'));
  }, [trips, allTime, rangeStart, rangeEnd]);

  const rows = useMemo(() => buildReportRows(rangeTrips, vehicleMap, employeeMap), [rangeTrips, vehicleMap, employeeMap]);
  const totals = useMemo(() => getWeekTotals(rows), [rows]);

  const rangeLabel = useMemo(() => {
    if (allTime || (!rangeStart && !rangeEnd)) return 'All Time';
    const s = rangeStart ? rangeStart.format('MMM DD, YYYY') : 'Start';
    const e = rangeEnd ? rangeEnd.format('MMM DD, YYYY') : 'Now';
    return `${s} – ${e}`;
  }, [allTime, rangeStart, rangeEnd]);

  const handleDownload = async (format) => {
    setGenerating(format);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const generatedAt = moment().utcOffset(TZ).format('MMM DD, YYYY HH:mm');
      const labelStart = rangeStart || moment('2000-01-01');
      const labelEnd = rangeEnd || moment();
      if (format === 'pdf') {
        downloadPDF(rows, labelStart, labelEnd, totals, generatedAt, `Period: ${rangeLabel}`, 'Trip_Report');
      } else {
        downloadCSV(rows, labelStart, labelEnd, totals, 'Trip_Report');
      }
    } finally {
      setGenerating(null);
    }
  };

  const handleSendEmail = async () => {
    if (!emailRecipient.trim()) return;
    setSending(true);
    try {
      await base44.functions.invoke('sendTripReportEmail', {
        recipient_email: emailRecipient.trim(),
        start_iso: rangeStart ? rangeStart.toISOString() : null,
        end_iso: rangeEnd ? rangeEnd.toISOString() : null,
        range_label: rangeLabel,
      });
      toast({ title: 'Report emailed', description: `Sent to ${emailRecipient.trim()}` });
    } catch {
      toast({ title: 'Failed to send email', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Trip Report
          </DialogTitle>
          <DialogDescription>
            Generate a trip report for any date range, or all-time.
          </DialogDescription>
        </DialogHeader>

        {/* Date range */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all-time"
              checked={allTime}
              onChange={(e) => setAllTime(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="all-time" className="text-sm cursor-pointer">All time</Label>
          </div>
          {!allTime && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End date</Label>
                <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-border bg-muted/40 p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-xl font-bold text-primary">{isLoading ? '…' : totals.count}</div>
            <div className="text-xs text-muted-foreground">Trips</div>
          </div>
          <div>
            <div className="text-xl font-bold text-primary">{isLoading ? '…' : totals.distance}</div>
            <div className="text-xs text-muted-foreground">Total km</div>
          </div>
          <div>
            <div className="text-xl font-bold text-primary">{isLoading ? '…' : totals.duration}</div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Period: {rangeLabel}</p>

        {/* Preview */}
        <div className="max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-border">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading trips…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No trips in this period.</div>
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
          <p className="text-xs text-muted-foreground">Showing first 50 of {rows.length} trips. All trips included in the download/email.</p>
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

        {/* Email */}
        <div className="border-t border-border pt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="w-4 h-4 text-primary" />
            Email Report
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="recipient@company.com"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              disabled={sending}
            />
            <Button
              variant="outline"
              className="gap-2 shrink-0"
              onClick={handleSendEmail}
              disabled={sending || !emailRecipient.trim() || rows.length === 0}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Recipient must be a registered Kannaz user.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}