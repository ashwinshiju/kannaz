import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ClipboardList, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import TripReportDialog from '@/components/reports/TripReportDialog';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
import moment from 'moment';

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
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list().catch(() => []),
  });
  const currentEmployee = employees.find((e) => e.email === user?.email);
  const canManage = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';

  const load = async () => {
    const items = await base44.entities.AuditLog.list('-created_date', 50);
    setData(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="space-y-6"><PageHeader title="Audit Log" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
      <PageHeader
        title="Audit Log"
        subtitle={`${data.length} entries`}
        action={canManage ? () => setReportOpen(true) : null}
        actionLabel="Trip Report"
        actionIcon={FileText}
      />
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
      {canManage && <TripReportDialog open={reportOpen} onOpenChange={setReportOpen} />}
    </div>
  );
}