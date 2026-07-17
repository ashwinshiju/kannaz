import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Users } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
import PullToRefresh from '@/components/shared/PullToRefresh';
import { useToast } from '@/components/ui/use-toast';

const QUERY_KEY = ['employees'];

const fields = [
  { key: 'emp_id', label: 'Employee ID', required: true },
  { key: 'full_name', label: 'Full Name', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'mobile', label: 'Mobile' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'manager_id', label: 'Manager ID' },
  { key: 'role', label: 'Role', type: 'select', options: [
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'employee', label: 'Employee' },
  ]},
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' },
    { value: 'disabled', label: 'Disabled' },
  ]},
];

const columns = [
  { key: 'emp_id', label: 'Emp ID' },
  { key: 'full_name', label: 'Name', render: (val) => <span className="font-medium">{val}</span> },
  { key: 'email', label: 'Email' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'role', label: 'Role', render: (val) => <span className="capitalize">{val}</span> },
  { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} /> },
];

export default function Employees() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data = [], isLoading: loading, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => base44.entities.Employee.list(),
  });

  // The Actions column (edit/delete) is restricted to Manager role (and Admin).
  const currentEmployee = data.find(e => e.email === user?.email);
  const canManage = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ role: 'employee', status: 'active' });
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ ...row });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setModalOpen(false);
    const previous = queryClient.getQueryData(QUERY_KEY);
    try {
      if (editing) {
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map(item => item.id === editing.id ? { ...item, ...form } : item)
        );
        await base44.entities.Employee.update(editing.id, form);
        toast({ title: 'Employee updated' });
      } else {
        const tempId = `temp-${Date.now()}`;
        queryClient.setQueryData(QUERY_KEY, (old) => [...(old || []), { ...form, id: tempId }]);
        const created = await base44.entities.Employee.create(form);
        queryClient.setQueryData(QUERY_KEY, (old) =>
          (old || []).map(item => item.id === tempId ? created : item)
        );
        toast({ title: 'Employee created' });
      }
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to save employee', variant: 'destructive' });
    } finally {
      setSaving(false);
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    const previous = queryClient.getQueryData(QUERY_KEY);
    queryClient.setQueryData(QUERY_KEY, (old) => (old || []).filter(item => item.id !== deleteDialog.id));
    try {
      await base44.entities.Employee.delete(deleteDialog.id);
      toast({ title: 'Employee deleted' });
    } catch {
      queryClient.setQueryData(QUERY_KEY, previous);
      toast({ title: 'Failed to delete employee', variant: 'destructive' });
    } finally {
      setSaving(false);
      setDeleteDialog(null);
      queryClient.invalidateQueries(QUERY_KEY);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Employees" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={refetch}>
      <PageHeader title="Employees" subtitle={`${data.length} total employees`} action={canManage ? openCreate : undefined} actionLabel="Add Employee" actionIcon={Users} />
      <DataTable
        data={data}
        columns={columns}
        searchPlaceholder="Search employees..."
        filters={[
          { key: 'role', label: 'Role', options: [
            { value: 'admin', label: 'Admin' }, { value: 'manager', label: 'Manager' }, { value: 'employee', label: 'Employee' },
          ]},
          { key: 'status', label: 'Status', options: [
            { value: 'active', label: 'Active' }, { value: 'disabled', label: 'Disabled' },
          ]},
        ]}
        onEdit={canManage ? openEdit : undefined}
        onDelete={canManage ? setDeleteDialog : undefined}
        emptyTitle="No employees yet"
        emptyDescription="Add your first employee to get started"
        emptyAction={canManage ? openCreate : undefined}
        emptyActionLabel="Add Employee"
      />
      </PullToRefresh>
      <FormModal
        open={modalOpen}
        onClose={setModalOpen}
        title={editing ? 'Edit Employee' : 'Add Employee'}
        fields={fields}
        values={form}
        onChange={(k, v) => setForm(prev => ({ ...prev, [k]: v }))}
        onSubmit={handleSave}
        loading={saving}
      />
      <ConfirmDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={handleDelete}
        title="Delete Employee"
        description={`Are you sure you want to delete "${deleteDialog?.full_name}"? This action cannot be undone.`}
        loading={saving}
      />
    </div>
  );
}