import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { ManagerPayrollDashboard } from '@/features/payroll/manager-payroll-dashboard';
import type { WorkerWithPayroll } from '@/features/payroll/manager-worker-card';

export const metadata = { title: 'Tiền công' };

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; worker?: string }>;
}) {
  await requirePermission('view_operations');
  const params = await searchParams;
  const today = businessDate();
  const month =
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(params.month ?? '') && params.month! <= today.slice(0, 7)
      ? params.month!
      : today.slice(0, 7);

  const db = await createClient();
  const [{ data, error }, profilesRes] = await Promise.all([
    db.rpc('manager_payroll', { p_month: `${month}-01` }),
    db.from('profiles').select('id,avatar_path'),
  ]);
  if (error) throw new Error('Không thể tải dữ liệu tiền công.');

  const avatarMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.avatar_path]));
  const workers = ((data ?? []) as WorkerWithPayroll[]).map((w) => ({
    ...w,
    avatar_path: avatarMap.get(w.id) ?? null,
  }));

  return (
    <ManagerPayrollDashboard
      workers={workers}
      month={month}
      today={today}
      selectedWorkerId={params.worker ?? ''}
    />
  );
}
