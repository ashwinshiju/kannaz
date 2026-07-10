import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Employees from '@/pages/Employees';
import Departments from '@/pages/Departments';
import Vehicles from '@/pages/Vehicles';
import VehicleProfile from '@/pages/VehicleProfile';
import Locations from '@/pages/Locations';
import Trips from '@/pages/Trips';
import StartTrip from '@/pages/StartTrip';
import FuelLog from '@/pages/FuelLog';
import MaintenancePage from '@/pages/MaintenancePage';
import Documents from '@/pages/Documents';
import LiveMap from '@/pages/LiveMap';
import Reports from '@/pages/Reports';
import AuditLog from '@/pages/AuditLog';
import Permissions from '@/pages/Permissions';
import Settings from '@/pages/Settings';
import { AnimatePresence, motion } from 'framer-motion';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (authError?.type === 'auth_required') {
    navigateToLogin();
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {(isLoadingPublicSettings || isLoadingAuth) ? (
        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-sm text-muted-foreground">Loading KANAZ...</p>
          </div>
        </motion.div>
      ) : authError?.type === 'user_not_registered' ? (
        <motion.div key="not-registered" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <UserNotRegisteredError />
        </motion.div>
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicles/:id" element={<VehicleProfile />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/trips/new" element={<StartTrip />} />
          <Route path="/fuel" element={<FuelLog />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/live-map" element={<LiveMap />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
        </Routes>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App