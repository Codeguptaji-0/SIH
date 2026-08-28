import { RequireAuth } from '@/components/RequireAuth';

/**
 * Guards /trainer/*.
 *
 * Matches the backend: the trainer routers are declared with
 * require_role("TRAINER", "ADMIN"), so an official who reaches these pages would
 * only ever receive 403s. Sending them back to their own dashboard is more
 * useful than rendering a page of permission errors.
 */
export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth allow={['TRAINER', 'ADMIN']}>{children}</RequireAuth>;
}
