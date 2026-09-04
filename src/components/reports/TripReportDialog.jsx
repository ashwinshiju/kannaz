import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download, Loader2, Mail, Send, ChevronLeft, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import moment from 'moment';
import { filterTripsByWeek, buildReportRows, getWeekTotals, getEmployeeDistanceTotals, downloadCSV, downloadPDF } from '@/utils/weeklyTripReport';
import { useToast } from '@/components/ui/use-toast';

const TZ = 240; // Asia/Dubai

const REPORT_TYPES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Range' },
];

export default function TripReportDialog({ open, onOpenChange }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reportType, setReportType] = useState('weekly');
  const [dayDate, setDayDate] = useState(moment().utcOffset(TZ).format('YYYY-MM-DD'));
  const [weekOffset, setWeekOffset] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generating, setGenerating] = useState(null);
  const [emailRecipient, setEmailRecipient] = useState(user?.email || '');
  const [sending, setSending] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);

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

  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    if (reportType === 'daily') {
      const base = dayDate ? moment(dayDate).utcOffset(TZ) : moment().utcOffset(TZ);
      return {
        rangeStart: base.clone().startOf('day'),
        rangeEnd: base.clone().endOf('day'),
        rangeLabel: base.format('MMM DD, YYYY'),
      };
    }
    if (reportType === 'weekly') {
      const ws = moment().utcOffset(TZ).startOf('isoWeek').add(weekOffset, 'weeks');
      const we = ws.clone().endOf('isoWeek');
      return {
        rangeStart: ws,
        rangeEnd: we,
        rangeLabel: `${ws.format('MMM DD')} – ${we.format('MMM DD, YYYY')}`,
      };
    }
    // custom
    const rs = startDate ? moment(startDate).utcOffset(TZ).startOf('day') : null;
    const re = endDate ? moment(endDate).utcOffset(TZ).endOf('day') : null;
    const label = (() => {
      const s = rs ? rs.format('MMM DD, YYYY') : 'Start';
      const e = re ? re.format('MMM DD, YYYY') : 'Now';
      return `${s} – ${e}`;
    })();
    return { rangeStart: rs, rangeEnd: re, rangeLabel: label };
  }, [reportType, dayDate, weekOffset, startDate, endDate]);

  const rangeTrips = useMemo(() => {
    if (!rangeStart && !rangeEnd) return trips;
    return filterTripsByWeek(trips, rangeStart || moment('2000-01-01'), rangeEnd || moment('2100-01-01'));
  }, [trips, rangeStart, rangeEnd]);

  // Employee filter (custom range only) — generates a combined report for
  // the selected people (e.g. Binil + Joemon).
  const empFilterActive = reportType === 'custom' && selectedEmpIds.length > 0;
  const filteredTrips = useMemo(() => {
    if (!empFilterActive) return rangeTrips;
    const ids = new Set(selectedEmpIds);
    const names = new Set(employees.filter((e) => ids.has(e.id)).map((e) => e.full_name));
    return rangeTrips.filter((t) => {
      const live = t.employee_ref_id ? employeeMap.get(t.employee_ref_id) : null;
      if (live) return ids.has(live.id);
      return names.has(t.employee_name || '');
    });
  }, [rangeTrips, empFilterActive, selectedEmpIds, employees, employeeMap]);

  const rows = useMemo(() => buildReportRows(filteredTrips, vehicleMap, employeeMap), [filteredTrips, vehicleMap, employeeMap]);
  const totals = useMemo(() => getWeekTotals(rows), [rows]);
  const personTotals = useMemo(
    () => (reportType === 'custom' ? getEmployeeDistanceTotals(rows) : []),
    [reportType, rows]
  );

  const handleDownload = async (format) => {
    setGenerating(format);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const generatedAt = moment().utcOffset(TZ).format('MMM DD, YYYY HH:mm');
      const labelStart = rangeStart || moment('2000-01-01');
      const labelEnd = rangeEnd || moment();
      const selectedNames = employees
        .filter((e) => selectedEmpIds.includes(e.id))
        .map((e) => e.full_name.split(' ')[0]);
      const filename = empFilterActive ? `Trip_Report_${selectedNames.join('_')}` : 'Trip_Report';
      const exportPersonTotals = reportType === 'custom' ? personTotals : null;
      if (format === 'pdf') {
        downloadPDF(rows, labelStart, labelEnd, totals, generatedAt, `Period: ${rangeLabel}`, filename, exportPersonTotals);
      } else {
        downloadCSV(rows, labelStart, labelEnd, totals, filename, exportPersonTotals);
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

  const handleSchedule = async () => {
    if (!emailRecipient.trim() || !scheduledTime) return;
    setScheduling(true);
    setScheduled(false);
    try {
      await base44.entities.ScheduledReport.create({
        recipient_email: emailRecipient.trim(),
        week_start_iso: rangeStart ? rangeStart.toISOString() : null,
        week_end_iso: rangeEnd ? rangeEnd.toISOString() : null,
        week_label: rangeLabel,
        scheduled_send_at: new Date(scheduledTime).toISOString(),
        status: 'pending',
      });
      setScheduled(true);
      setScheduledTime('');
    } catch {
      toast({ title: 'Failed to schedule report', variant: 'destructive' });
    } finally {
      setScheduling(false);
    }
  };

  const weeklyLabel = weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `${weekOffset < 0 ? '' : '+'}${weekOffset} week${Math.abs(weekOffset) === 1 ? '' : 's'}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Report
          </DialogTitle>
          <DialogDescription>
            Generate a trip report by day, week, or custom date range.
          </DialogDescription>
        </DialogHeader>

        {/* Report type selector */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {REPORT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setReportType(t.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${reportType === t.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Date picker per type */}
        {reportType === 'daily' && (
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
            </div>
          </div>
        )}

        {reportType === 'weekly' && (
          <div>
            <div className="flex items-center justify-between gap-2 py-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center flex-1">
                <div className="text-sm font-semibold">{rangeLabel}</div>
                <div className="text-xs text-muted-foreground">{weeklyLabel}</div>
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-center -mt-1 mb-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                Jump to this week
              </Button>
            </div>
          </div>
        )}

        {reportType === 'custom' && (
          <>
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
            <div className="space-y-1">
              <Label className="text-xs">Employees (optional — leave empty for all)</Label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                {employees.map((e) => {
                  const selected = selectedEmpIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedEmpIds((prev) =>
                        selected ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                      )}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}
                    >
                      {e.full_name}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

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

        {reportType === 'custom' && personTotals.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5 -mt-1">
            <p className="text-xs font-medium">Total distance per person</p>
            {personTotals.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {p.name} <span className="text-muted-foreground/70">({p.trips} trip{p.trips === 1 ? '' : 's'})</span>
                </span>
                <span className="font-mono font-medium">{p.distance.toFixed(1)} km</span>
              </div>
            ))}
          </div>
        )}

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
                  <th className="p-2 font-medium">End</th>
                  <th className="p-2 font-medium">Duration</th>
                  <th className="p-2 font-medium">Purpose</th>
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
                    <td className="p-2 whitespace-nowrap">{r.endDateTime}</td>
                    <td className="p-2 whitespace-nowrap">{r.duration}</td>
                    <td className="p-2 capitalize">{r.purpose}</td>
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

        {/* Email / Schedule */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="w-4 h-4 text-primary" />
            Email Report
          </div>
          {/* Mode toggle */}
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
            <button
              onClick={() => { setScheduleMode(false); setScheduled(false); }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${!scheduleMode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Send now
            </button>
            <button
              onClick={() => { setScheduleMode(true); setScheduled(false); }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${scheduleMode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Schedule for later
            </button>
          </div>

          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="recipient@company.com"
              value={emailRecipient}
              onChange={(e) => { setEmailRecipient(e.target.value); setScheduled(false); }}
              disabled={sending || scheduling}
            />
            {scheduleMode && (
              <Input
                type="datetime-local"
                value={scheduledTime}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => { setScheduledTime(e.target.value); setScheduled(false); }}
                disabled={scheduling}
                className="shrink-0 w-[200px]"
              />
            )}
            {!scheduleMode ? (
              <Button
                variant="outline"
                className="gap-2 shrink-0"
                onClick={handleSendEmail}
                disabled={sending || !emailRecipient.trim() || rows.length === 0 || empFilterActive}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </Button>
            ) : (
              <Button
                variant="outline"
                className="gap-2 shrink-0"
                onClick={handleSchedule}
                disabled={scheduling || !emailRecipient.trim() || !scheduledTime || rows.length === 0 || empFilterActive}
              >
                {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : scheduled ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4" />}
                {scheduled ? 'Scheduled' : 'Schedule'}
              </Button>
            )}
          </div>
          {scheduleMode && scheduled && (
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Report scheduled — it will be emailed within 15 minutes of the chosen time.
            </p>
          )}
          {empFilterActive ? (
            <p className="text-xs text-warning">Email is unavailable while an employee filter is active — use Download instead.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Recipient must be a registered Kannaz user.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}