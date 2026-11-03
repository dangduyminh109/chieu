import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { ProfitDashboard, type ProfitReport } from '@/features/reports/profit-dashboard';
export const metadata = { title: 'Giá vốn & lãi bán' };
export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; period?: string }>;
}) {
  await requirePermission('view_financials');
  const params = await searchParams,
    today = businessDate();
  const month =
    params.month &&
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(params.month) &&
    params.month <= today.slice(0, 7)
      ? params.month
      : today.slice(0, 7);
  const period = params.period === 'year' ? 'year' : 'month';
  const db = await createClient();
  const result = await db.rpc('profit_report', { p_anchor: `${month}-01`, p_period: period });
  if (result.error) throw new Error('Không tải được báo cáo giá vốn và lãi bán.');
  return (
    <div className="space-y-5">
      <PageHeader title="Giá vốn & lãi bán" />
      <ProfitDashboard
        data={result.data as ProfitReport}
        month={month}
        period={period}
        today={today}
      />
    </div>
  );
}
