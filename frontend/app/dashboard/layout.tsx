import { RequireAuth } from '@/components/RequireAuth';

/**
 * Guards every /dashboard/* route in one place.
 *
 * A layout wraps its whole subtree, so adding the check here covers the nine
 * official pages at once and there is no page left to forget. Any signed-in role
 * may read this area - a trainer or director looking at the officer view is
 * legitimate - so only the presence of a session is required.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
