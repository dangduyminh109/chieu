import { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { businessDate } from '@/lib/utils';
import { getCatalog, getRates, getWorkLogs } from '@/features/shared/data';
import { getWorkerMonthlyDashboard } from '@/features/production/data';
import { WorkerSchedule } from '@/features/production/worker-schedule';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { ManagerStatisticsDashboard } from '@/features/dashboard/manager-statistics';
import type { ManagerStatistics, StatisticsTab } from '@/features/dashboard/statistics-types';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = {
  title: 'Thống kê',
  description: 'Thống kê sản lượng, tiến độ và tiền công theo tuần, tháng, năm',
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    month?: string;
    view?: string;
    period?: string;
    tab?: string;
    worker?: string;
    stage?: string;
  }>;
}) {
  const session = await requireSession();
  const manager = can(session.roles, 'view_operations');
  const today = businessDate();
  const params = searchParams ? await searchParams : {};
  const month = params.month;

  // WORKER VIEW: Full Monthly Schedule Calendar, 4 Metric Cards & Weekly/Monthly/Yearly charts
  if (!manager || (params.view === 'personal' && session.roles.includes('WORKER'))) {
    const [catalog, rates] = await Promise.all([getCatalog(), getRates()]);
    const [workerDashboard, recent] = await Promise.all([
      getWorkerMonthlyDashboard(session.userId, month),
      getWorkLogs(session.userId, `${(month || today).slice(0, 7)}-01`, today, 1, 50),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader
          title="Thống kê"
          description="Theo dõi sản lượng dệt, tiến độ và năng suất làm việc."
          icon={BarChart3}
          action={
            manager ? (
              <Link
                href="/analytics"
                className="text-xs font-semibold text-primary hover:underline self-start sm:self-auto"
              >
                ← Về thống kê tổng hợp
              </Link>
            ) : undefined
          }
        />

        <WorkerSchedule
          summary={workerDashboard}
          mats={catalog.mats}
          stages={catalog.stages}
          rates={rates}
          workerId={session.userId}
          today={today}
          recentLogs={recent.logs}
        />
      </div>
    );
  }

  const targetMonth =
    month && /^20\d{2}-(0[1-9]|1[0-2])$/.test(month) && month <= today.slice(0, 7)
      ? month
      : today.slice(0, 7);
  const period = params.period === 'year' ? 'year' : 'month';
  const tab: StatisticsTab =
    params.tab === 'cashflow' || params.tab === 'payroll' ? params.tab : 'productivity';
  const db = await createClient();
  const stages = await db.from('production_stages').select('id,name,code').order('sort_order');
  if (stages.error) throw new Error('Không thể tải công đoạn.');
  const stage =
    stages.data.find((s) => s.id === params.stage)?.id ??
    stages.data.find((s) => s.code === 'WEAVING')?.id ??
    stages.data[0]?.id ??
    '';
  const worker = z.uuid().safeParse(params.worker).success ? params.worker! : '';
  const { data, error } = await db.rpc('manager_statistics', {
    p_anchor: `${targetMonth}-01`,
    p_period: period,
    p_worker: worker || null,
    p_stage: tab === 'productivity' ? stage || null : null,
  });
  if (error) throw new Error('Không thể tải thống kê.');
  return (
    <div className="space-y-5">
      <PageHeader
        title="Thống kê"
        icon={BarChart3}
        action={
          session.roles.includes('WORKER') ? (
            <Link href="/analytics?view=personal" className="text-sm font-semibold text-primary">
              Công của tôi
            </Link>
          ) : undefined
        }
      />
      <ManagerStatisticsDashboard
        data={data as ManagerStatistics}
        tab={tab}
        period={period}
        month={targetMonth}
        today={today}
        worker={worker}
        stage={stage}
      />
    </div>
  );
}
