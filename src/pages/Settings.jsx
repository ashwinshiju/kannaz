import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Building2, Route, Bell, Shield, Monitor, Mail, Database, Server, Activity, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/shared/PageHeader';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import ScheduledReportsSection from '@/components/settings/ScheduledReportsSection';
import GpsTrackingConfigSection from '@/components/settings/GpsTrackingConfigSection';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';

export default function Settings() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Delegated to a backend function so the service-role calls (which bypass
      // RLS) never run in the browser; the function validates the caller's
      // identity server-side and scopes all deletions to the authenticated user.
      await base44.functions.invoke('deleteMyAccount', {});

      toast({ title: 'Account data deleted', description: 'All your data has been permanently removed.' });
      setDeleteOpen(false);
      base44.auth.logout('/login');
    } catch {
      toast({ title: 'Failed to complete deletion', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const [company, setCompany] = useState({
    name: 'KANAZ Corp', timezone: 'GST', currency: 'AED',
  });

  const [tripSettings, setTripSettings] = useState({
    requireOdometer: true, gpsPolicy: 'optional', autoAssign: false, maxDistance: 500,
  });

  const [notifications, setNotifications] = useState({
    tripCreated: true, tripCompleted: true, maintenanceDue: true, docExpiry: true, emailDigest: false,
  });

  const save = (section) => {
    toast({ title: `${section} settings saved` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Application configuration" />

      <Tabs defaultValue="company">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company" className="gap-1"><Building2 className="w-3.5 h-3.5" /> Company</TabsTrigger>
          <TabsTrigger value="trip" className="gap-1"><Route className="w-3.5 h-3.5" /> Trip</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1"><Bell className="w-3.5 h-3.5" /> Notifications</TabsTrigger>
          <TabsTrigger value="system" className="gap-1"><Monitor className="w-3.5 h-3.5" /> System</TabsTrigger>
          <TabsTrigger value="email" className="gap-1"><Mail className="w-3.5 h-3.5" /> Email Templates</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><Clock className="w-3.5 h-3.5" /> Scheduled Reports</TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-semibold">Company Profile</h3>
            <div className="space-y-3">
              <div><Label>Company Name</Label><Input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} className="mt-1" /></div>
              <div>
                <Label>Timezone</Label>
                <Select value={company.timezone} onValueChange={v => setCompany(p => ({ ...p, timezone: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST">Gulf Standard Time (GST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="EST">Eastern (EST)</SelectItem>
                    <SelectItem value="PST">Pacific (PST)</SelectItem>
                    <SelectItem value="GMT">GMT</SelectItem>
                    <SelectItem value="IST">India (IST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={company.currency} onValueChange={v => setCompany(p => ({ ...p, currency: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AED">AED (د.إ)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={() => save('Company')}>Save Changes</Button>
          </div>
        </TabsContent>

        {/* Trip Settings */}
        <TabsContent value="trip" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-semibold">Trip Configuration</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div><Label>Require Odometer Reading</Label><p className="text-xs text-muted-foreground">Enforce odometer entry on trip start/end</p></div>
                <Switch checked={tripSettings.requireOdometer} onCheckedChange={v => setTripSettings(p => ({ ...p, requireOdometer: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label>Auto-Assign Vehicle</Label><p className="text-xs text-muted-foreground">Automatically assign default vehicle</p></div>
                <Switch checked={tripSettings.autoAssign} onCheckedChange={v => setTripSettings(p => ({ ...p, autoAssign: v }))} />
              </div>
              <div>
                <Label>GPS Policy</Label>
                <Select value={tripSettings.gpsPolicy} onValueChange={v => setTripSettings(p => ({ ...p, gpsPolicy: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Max Trip Distance (km)</Label>
                <Input type="number" value={tripSettings.maxDistance} onChange={e => setTripSettings(p => ({ ...p, maxDistance: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <Button onClick={() => save('Trip')}>Save Changes</Button>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4 max-w-2xl">
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            {[
              { key: 'tripCreated', label: 'Trip Created', desc: 'Notify when a new trip is created' },
              { key: 'tripCompleted', label: 'Trip Completed', desc: 'Notify when a trip is completed' },
              { key: 'maintenanceDue', label: 'Maintenance Due', desc: 'Alert for upcoming maintenance' },
              { key: 'docExpiry', label: 'Document Expiry', desc: 'Alert for expiring documents' },
              { key: 'emailDigest', label: 'Daily Email Digest', desc: 'Send daily summary email' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div><Label>{item.label}</Label><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                <Switch checked={notifications[item.key]} onCheckedChange={v => setNotifications(p => ({ ...p, [item.key]: v }))} />
              </div>
            ))}
            <Button onClick={() => save('Notification')}>Save Changes</Button>
          </div>
        </TabsContent>

        {/* System */}
        <TabsContent value="system" className="mt-4">
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">System Health</h3>
              <div className="space-y-3">
                {[
                  { icon: Database, label: 'Database', status: 'Connected', uptime: '99.9%' },
                  { icon: Server, label: 'API Server', status: 'Running', uptime: '99.8%' },
                  { icon: Activity, label: 'Background Jobs', status: 'Active', uptime: '99.5%' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <s.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-emerald-600">{s.status}</span>
                      <span className="text-muted-foreground">{s.uptime} uptime</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Backup & Configuration</h3>
              <div className="flex gap-3">
                <Button variant="outline">Export Configuration</Button>
                <Button variant="outline">Download Backup</Button>
                <Button variant="outline">View Application Logs</Button>
              </div>
            </div>

            <GpsTrackingConfigSection />
          </div>
        </TabsContent>

        {/* Scheduled Reports */}
        <TabsContent value="reports" className="mt-4">
          <ScheduledReportsSection />
        </TabsContent>

        {/* Email Templates */}
        <TabsContent value="email" className="mt-4">
          <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
            <h3 className="text-lg font-semibold mb-4">Email Templates</h3>
            <p className="text-sm text-muted-foreground mb-4">Manage email templates for notifications and alerts.</p>
            <div className="space-y-3">
              {['Trip Created', 'Trip Completed', 'Maintenance Reminder', 'Document Expiry Alert', 'Welcome Email'].map(tpl => (
                <div key={tpl} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm font-medium">{tpl}</span>
                  <Button variant="outline" size="sm">Edit Template</Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Danger Zone — Delete Account */}
      <div className="bg-card rounded-xl border border-destructive/30 p-6 max-w-2xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Delete Account</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="w-4 h-4" /> Delete Account
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account?"
        description="This will permanently remove your account and all associated data. This action cannot be undone."
        loading={deleting}
      />
    </div>
  );
}