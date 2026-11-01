import { requireSession } from '@/lib/auth/session';
import { Shell } from '@/components/layout/shell';
export const dynamic = 'force-dynamic';
export default async function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <Shell profile={session.profile} roles={session.roles}>
      {children}
    </Shell>
  );
}
