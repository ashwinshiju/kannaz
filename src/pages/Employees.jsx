import React, { useState, useEffect } from 'react';
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
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const load = async () => {
    const items = await base44.entities.Employee.list();
    setData(items);
    setLoading(false);
  };

  // The Actions column (edit/delete) is restricted to Manager role (and Admin).
  const currentEmployee = data.find(e => e.email === user?.email);
  const canManage = currentEmployee?.role === 'manager' || currentEmployee?.role === 'admin';

  useEffect(() => { load(); }, []);

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
    if (editing) {
      const previous = data;
      setData(prev => prev.map(item => item.id === editing.id ? { ...item, ...form } : item));
      try {
        await base44.entities.Employee.update(editing.id, form);
        toast({ title: 'Employee updated' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to update employee', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const previous = data;
      setData(prev => [...prev, { ...form, id: tempId }]);
      try {
        const created = await base44.entities.Employee.create(form);
        setData(prev => prev.map(item => item.id === tempId ? created : item));
        toast({ title: 'Employee created' });
      } catch {
        setData(previous);
        toast({ title: 'Failed to create employee', variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    const previous = data;
    const item = deleteDialog;
    setData(prev => prev.filter(d => d.id !== item.id));
    setDeleteDialog(null);
    setSaving(true);
    try {
      await base44.entities.Employee.delete(item.id);
      toast({ title: 'Employee deleted' });
    } catch {
      setData(previous);
      toast({ title: 'Failed to delete employee', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Employees" /><TableSkeleton /></div>;

  return (
    <div>
      <PullToRefresh onRefresh={load}>
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