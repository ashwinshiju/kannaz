import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/**
 * Resolves the current logged-in user's role from the Employee entity,
 * matched against the live auth session (base44.auth.me()).
 *
 * Returns:
 *  - role: the Employee.role string ('admin' | 'manager' | 'employee')
 *  - isAdmin: true only when role === 'admin'
 *  - canManage: true when role is 'admin' or 'manager'
 *  - currentEmployee: the full Employee record (for department checks, etc.)
 */
export function useUserRole() {
  const { user } = useAuth();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list().catch(() => []),
  });

  const currentEmployee = employees.find((e) => e.email === user?.email);
  const role = currentEmployee?.role || 'employee';
  const isAdmin = role === 'admin';
  const canManage = role === 'admin' || role === 'manager';

  return { role, isAdmin, canManage, currentEmployee };
}