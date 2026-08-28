import { RequireAuth } from '@/components/RequireAuth';

/**
 * Guards /admin/*.
 *
 * ADMIN only, matching require_role("ADMIN") on the admin router. The analytics
 * page carried its own copy of this check; the layout now owns it, so a future
 * admin page cannot ship without one.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth allow={['ADMIN']}>{children}</RequireAuth>;
}
