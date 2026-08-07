import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mail, Clock, Trash2, Loader2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/shared/StatusBadge';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import moment from 'moment';

const TZ = 240; // Asia/Dubai

function formatDubai(iso) {
  if (!iso) return '—';
  return moment.utc(iso).utcOffset(TZ).format('MMM DD, YYYY HH:mm');
}

export default function ScheduledReportsSection() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['scheduled-reports'],
    queryFn: () => base44.entities.ScheduledReport.list('-created_date', 200),
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await base44.entities.ScheduledReport.delete(deleteId);
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Scheduled Report Emails</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Weekly trip reports scheduled to be emailed to registered users.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Inbox className="w-10 h-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No scheduled reports yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Recipient</th>
                <th className="p-3 font-medium">Week</th>
                <th className="p-3 font-medium whitespace-nowrap">Scheduled For</th>
                <th className="p-3 font-medium whitespace-nowrap">Sent At</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="p-3">{r.recipient_email}</td>
                  <td className="p-3 whitespace-nowrap">{r.week_label}</td>
                  <td className="p-3 whitespace-nowrap flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    {formatDubai(r.scheduled_send_at)}
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatDubai(r.sent_at)}</td>
                  <td className="p-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-3 text-right">
                    {r.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(r.id)}
                        aria-label="Cancel scheduled report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Cancel Scheduled Report?"
        description="This will cancel the scheduled email. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}