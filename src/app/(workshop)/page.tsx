import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { businessDate } from '@/lib/utils';
import { getCatalog, getRates, getWorkLogs } from '@/features/shared/data';
import { getWorkerMonthlyDashboard } from '@/features/production/data';
import { WorkerTodayView } from '@/features/production/worker-today';
import { ManagerOverview } from '@/features/dashboard/manager-overview';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string }>;
}) {
  const session = await requireSession();
  const manager = can(session.roles, 'view_operations');
  const today = businessDate();
  const params = searchParams ? await searchParams : {};
  const month = params.month;

  // WORKER VIEW: Direct monthly schedule, accumulated earnings, weekly/monthly/yearly chart
  if (!manager) {
    const [catalog, rates] = await Promise.all([getCatalog(), getRates()]);
    const [workerDashboard, recent] = await Promise.all([
      getWorkerMonthlyDashboard(session.userId, month),
      getWorkLogs(session.userId, `${(month || today).slice(0, 7)}-01`, today, 1, 50),
    ]);

    return (
      <div className="space-y-6">
        <WorkerTodayView
          summary={workerDashboard}
          mats={catalog.mats}
          stages={catalog.stages}
          rates={rates}
          workerId={session.userId}
          today={today}
          recentLogs={recent.logs}
          workerName={session.profile.full_name}
        />
      </div>
    );
  }

  return <ManagerOverview today={today} name={session.profile.full_name} />;
}
