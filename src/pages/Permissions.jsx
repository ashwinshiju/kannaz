import React, { useState } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';

const modules = [
  'Dashboard', 'Employees', 'Departments', 'Vehicles', 'Locations',
  'Trips', 'Fuel Log', 'Maintenance', 'Documents', 'Reports',
  'Live Map', 'Audit Log', 'Settings', 'Permissions',
];
const capabilities = ['View', 'Create', 'Edit', 'Delete'];
const roles = ['Admin', 'Manager', 'Employee'];

const defaultPerms = {
  Admin: Object.fromEntries(modules.map(m => [m, { View: true, Create: true, Edit: true, Delete: true }])),
  Manager: Object.fromEntries(modules.map(m => [m, {
    View: true,
    Create: !['Audit Log', 'Settings', 'Permissions'].includes(m),
    Edit: !['Audit Log', 'Settings', 'Permissions'].includes(m),
    Delete: !['Audit Log', 'Settings', 'Permissions', 'Employees'].includes(m),
  }])),
  Employee: Object.fromEntries(modules.map(m => [m, {
    View: !['Audit Log', 'Settings', 'Permissions'].includes(m),
    Create: ['Trips', 'Fuel Log'].includes(m),
    Edit: ['Trips'].includes(m),
    Delete: false,
  }])),
};

export default function Permissions() {
  const [perms, setPerms] = useState(defaultPerms);
  const [activeRole, setActiveRole] = useState('Admin');
  const { toast } = useToast();

  const toggle = (module, cap) => {
    setPerms(prev => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [module]: {
          ...prev[activeRole][module],
          [cap]: !prev[activeRole][module][cap],
        },
      },
    }));
  };

  const handleSave = () => {
    toast({ title: 'Permissions saved', description: `${activeRole} permissions have been updated.` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Permission Matrix" subtitle="Control module access by role" />

      {/* Role Tabs */}
      <div className="flex gap-2">
        {roles.map(role => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeRole === role
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      {/* Permission Grid */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground w-48">Module</th>
                {capabilities.map(cap => (
                  <th key={cap} className="text-center px-4 py-3 font-semibold text-muted-foreground w-24">{cap}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {modules.map(module => (
                <tr key={module} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{module}</td>
                  {capabilities.map(cap => (
                    <td key={cap} className="text-center px-4 py-3">
                      <Checkbox
                        checked={perms[activeRole]?.[module]?.[cap] || false}
                        onCheckedChange={() => toggle(module, cap)}
                        aria-label={`${activeRole} ${cap} ${module}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2">
          <Shield className="w-4 h-4" /> Save Permissions
        </Button>
      </div>
    </div>
  );
}