import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ClipboardList, Download, FileText } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportToCSV } from '@/utils/csvExport';
import moment from 'moment';

const exportColumns = [
  { key: 'created_date', label: 'Timestamp' },
  { key: 'user_name', label: 'User' },
  { key: 'user_email', label: 'Email' },
  { key: 'action', label: 'Action' },
  { key: 'module', label: 'Module' },
  { key: 'entity_type', label: 'Entity Type' },
  { key: 'entity_id', label: 'Entity ID' },
  { key: 'details', label: 'Details' },
  { key: 'ip_address', label: 'IP Address' },
];

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

  const load = async () => {
    const items = await base44.entities.AuditLog.list('-created_date', 50);
    setData(items);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleExport = () => {
    const rows = data.map(r => ({
      ...r,
      created_date: r.created_date ? moment(r.created_date).format('YYYY-MM-DD HH:mm:ss') : '',
    }));
    exportToCSV(rows, exportColumns, `audit-log-${moment().format('YYYYMMDD-HHmm')}`);
    toast({ title: 'Audit report exported' });
  };

  const handleGenerateReport = async () => {
    const items = await base44.entities.AuditLog.list('-created_date', 500);
    const rows = items.map(r => ({
      ...r,
      created_date: r.created_date ? moment(r.created_date).format('YYYY-MM-DD HH:mm:ss') : '',
    }));
    exportToCSV(rows, exportColumns, `audit-report-${moment().format('YYYYMMDD-HHmm')}`);
    toast({ title: `Audit report generated (${rows.length} entries)` });
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Audit Log" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
      <PageHeader title="Audit Log" subtitle={`${data.length} entries`} />
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
        <Button variant="default" size="sm" onClick={handleGenerateReport}>
          <FileText className="w-4 h-4 mr-1" /> Generate Full Report
        </Button>
      </div>
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
    </div>
  );
}