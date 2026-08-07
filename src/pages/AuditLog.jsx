import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ClipboardList, Download, Mail, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { downloadAuditPDF, downloadAuditCSV } from '@/utils/auditLogReport';
import moment from 'moment';

const TZ = 240; // Asia/Dubai
const DOWNLOAD_LIMIT = 1000;

const columns = [
  { key: 'created_date', label: 'Timestamp', render: (val) => val ? moment(val).format('MMM DD, HH:mm:ss') : '—' },
  { key: 'user_name', label: 'User', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'user_email', label: 'Email' },
  { key: 'action', label: 'Action', render: (val) => <StatusBadge status={val} /> },
  { key: 'module', label: 'Module' },
  { key: 'entity_type', label: 'Entity' },
  { key: 'details', label: 'Details', render: (val) => <span className="text-muted-foreground text-xs truncate max-w-[200px] block">{val || '—'}</span> },
  { key: 'ip_address', label: 'IP Address', render: (val) => <span className="font-mono text-xs">{val || '—'}</span> },
];

export default function AuditLog() {
  const { toast } = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);

  const load = async () => {
    const items = await base44.entities.AuditLog.list('-created_date', 50);
    setData(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDownload = async (format) => {
    setGenerating(format);
    try {
      const rows = await base44.entities.AuditLog.list('-created_date', DOWNLOAD_LIMIT);
      const generatedAt = moment().utcOffset(TZ).format('MMM DD, YYYY HH:mm');
      if (format === 'pdf') downloadAuditPDF(rows, generatedAt);
      else downloadAuditCSV(rows);
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
        report_type: 'audit',
        report_label: 'Audit Log',
        scheduled_send_at: new Date(scheduledTime).toISOString(),
        status: 'pending',
      });
      setScheduled(true);
      setEmailRecipient('');
      setScheduledTime('');
      toast({ title: 'Audit log email scheduled' });
    } finally {
      setScheduling(false);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Audit Log" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
        <PageHeader title="Audit Log" subtitle={`${data.length} entries`}>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownload('pdf')} disabled={generating !== null}>
            {generating === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownload('csv')} disabled={generating !== null}>
            {generating === 'csv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            CSV
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { setScheduleOpen(true); setScheduled(false); }}>
            <Mail className="w-4 h-4" />
            Schedule Email
          </Button>
        </PageHeader>
        <DataTable
          data={data} columns={columns} searchPlaceholder="Search audit log..."
          filters={[
            { key: 'action', label: 'Action', options: [
              { value: 'login', label: 'Login' }, { value: 'create', label: 'Create' },
              { value: 'update', label: 'Update' }, { value: 'delete', label: 'Delete' },
            ]},
          ]}
          emptyTitle="No audit entries yet"
          emptyDescription="Activity will be logged here"
        />
      </PullToRefresh>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Schedule Audit Log Email
            </DialogTitle>
            <DialogDescription>
              Email the audit log to a registered app user at a scheduled time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="audit-email" className="text-xs">Recipient email</Label>
              <Input id="audit-email" type="email" placeholder="name@company.com" value={emailRecipient} onChange={(e) => { setEmailRecipient(e.target.value); setScheduled(false); }} disabled={scheduling} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="audit-time" className="text-xs">Send at</Label>
              <Input id="audit-time" type="datetime-local" value={scheduledTime} min={new Date().toISOString().slice(0, 16)} onChange={(e) => { setScheduledTime(e.target.value); setScheduled(false); }} disabled={scheduling} />
            </div>
            {scheduled && (
              <p className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Audit log email scheduled — it will be sent within 15 minutes of the chosen time.
              </p>
            )}
            <Button className="w-full gap-2" onClick={handleSchedule} disabled={scheduling || !emailRecipient.trim() || !scheduledTime}>
              {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : scheduled ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Clock className="w-4 h-4" />}
              {scheduled ? 'Email Scheduled' : 'Schedule Email'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}