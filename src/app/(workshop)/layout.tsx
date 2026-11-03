import { requireSession } from '@/lib/auth/session';
import { getCatalog, getRates } from '@/features/shared/data';
import { businessDate } from '@/lib/utils';
import { Denied } from '@/components/ui/states';
import { Shell } from '@/components/layout/shell';

export const dynamic = 'force-dynamic';

export default async function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const [{ mats, stages }, rates] = await Promise.all([getCatalog(), getRates()]);

  const today = businessDate();
  const defaultStageId = session.skills?.[0] || stages[0]?.id;

  if (!session.roles.length)
    return (
      <Shell
        profile={session.profile}
        roles={session.roles}
        mats={mats}
        stages={stages}
        rates={rates}
        workerId={session.userId}
        today={today}
        defaultStageId={defaultStageId}
      >
        <Denied />
      </Shell>
    );

  return (
    <Shell
      profile={session.profile}
      roles={session.roles}
      mats={mats}
      stages={stages}
      rates={rates}
      workerId={session.userId}
      today={today}
      defaultStageId={defaultStageId}
    >
      {children}
    </Shell>
  );
}
