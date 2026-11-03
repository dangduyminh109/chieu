import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { Denied } from '@/components/ui/states';
import { WagesDashboard, type WageMonth } from '@/features/payroll/wages-dashboard';

export const metadata = { title: 'Tiền công' };

export default async function WagesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await requireSession();
  if (!session.roles.includes('WORKER')) return <Denied />;

  const params = await searchParams;
  const currentDate = businessDate();
  const currentYear = Number(currentDate.slice(0, 4));
  const year = /^\d{4}$/.test(params.year ?? '') ? Number(params.year) : currentYear;
  if (year < 2000 || year > 2100) return <Denied />;

  const db = await createClient();

  // Find earliest year with work logs for this worker to ensure all historical years are fetched
  const { data: earliestLog } = await db
    .from('work_logs')
    .select('work_date')
    .eq('worker_id', session.userId)
    .order('work_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  const minYear = earliestLog?.work_date
    ? Math.max(2000, Number(earliestLog.work_date.slice(0, 4)))
    : currentYear - 1;

  const allYears = [];
  for (let y = Math.min(minYear, year - 1, currentYear - 1); y <= Math.max(currentYear, year); y++) {
    if (y >= 2000 && y <= 2100) allYears.push(y);
  }
  const yearsToFetch = Array.from(new Set(allYears));

  const results = await Promise.all(
    yearsToFetch.map(async (y) => {
      const { data, error } = await db.rpc('worker_monthly_wages', { p_year: y });
      if (error) throw new Error(`Không thể tải lương năm ${y}.`);
      return { year: y, months: (data ?? []) as WageMonth[] };
    }),
  );

  // All months combined across fetched years, sorted newest first
  const allMonthsMap = new Map<string, WageMonth>();
  for (const r of results) {
    for (const m of r.months) {
      allMonthsMap.set(m.month, m);
    }
  }

  const allMonthsSorted = Array.from(allMonthsMap.values()).sort((a, b) =>
    b.month.localeCompare(a.month),
  );

  // Tab 1: All history months for pagination
  const historyMonths = allMonthsSorted;

  // Tab 2: Months of the selected year & previous year for comparison
  const selectedYearMonths = results.find((r) => r.year === year)?.months ?? [];

  return (
    <WagesDashboard
      historyMonths={historyMonths}
      recent12Months={historyMonths.slice(0, 12)}
      selectedYearMonths={selectedYearMonths}
      currentYear={currentYear}
      selectedYear={year}
      currentDate={currentDate}
    />
  );
}
