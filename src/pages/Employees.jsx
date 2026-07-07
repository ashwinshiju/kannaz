import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import DataTable from '@/components/shared/DataTable';
import FormModal from '@/components/shared/FormModal';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusBadge from '@/components/shared/StatusBadge';
import { TableSkeleton } from '@/components/shared/LoadingSkeleton';
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

  const load = async () => {
    const items = await base44.entities.Employee.list();
    setData(items);
    setLoading(false);
  };

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
    if (editing) {
      await base44.entities.Employee.update(editing.id, form);
      toast({ title: 'Employee updated' });
    } else {
      await base44.entities.Employee.create(form);
      toast({ title: 'Employee created' });
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = async () => {
    setSaving(true);
    await base44.entities.Employee.delete(deleteDialog.id);
    toast({ title: 'Employee deleted' });
    setSaving(false);
    setDeleteDialog(null);
    load();
  };

  if (loading) return <div className="space-y-6"><PageHeader title="Employees" /><TableSkeleton /></div>;

  return (
    <div>
      <PageHeader title="Employees" subtitle={`${data.length} total employees`} action={openCreate} actionLabel="Add Employee" actionIcon={Users} />
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
        onEdit={openEdit}
        onDelete={setDeleteDialog}
        emptyTitle="No employees yet"
        emptyDescription="Add your first employee to get started"
        emptyAction={openCreate}
        emptyActionLabel="Add Employee"
      />
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