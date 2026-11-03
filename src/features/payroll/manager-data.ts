import 'server-only';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export type ManagerLog = {
  id: string;
  date: string;
  stage: string;
  mat: string | null;
  quantity: number;
  rate: string;
  earned: string;
  paid: string;
  received: string;
};
export type ManagerWorker = {
  id: string;
  name: string;
  active: boolean;
  logs: ManagerLog[];
  payments: { id: string; date: string; amount: string; method: string; notes: string }[];
};
export const wageMoney = (value: bigint | string) => `${BigInt(value).toLocaleString('vi-VN')} đ`;
export function wageTotals(logs: ManagerLog[]) {
  return logs.reduce(
    (a, l) => {
      const earned = BigInt(l.earned),
        paid = BigInt(l.paid),
        received = BigInt(l.received);
      a.earned += earned;
      a.paid += paid;
      a.received += received;
      a.remaining += earned - (paid > received ? paid : received);
      return a;
    },
    { earned: 0n, paid: 0n, received: 0n, remaining: 0n },
  );
}
export async function getManagerPayroll(month: string): Promise<ManagerWorker[]> {
  await requirePermission('view_operations');
  const db = await createClient();
  const { data, error } = await db.rpc('manager_payroll', { p_month: `${month}-01` });
  if (error) throw new Error('Không thể tải công và lương thợ.');
  return data as ManagerWorker[];
}
