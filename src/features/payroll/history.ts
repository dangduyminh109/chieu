import 'server-only';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { dateSchema } from '@/features/production/schemas';
export async function getWagePayments(workerId: string, from: string, to: string, page = 1) {
  const session = await requireSession();
  z.uuid().parse(workerId);
  dateSchema.parse(from);
  dateSchema.parse(to);
  z.number().int().min(1).max(100000).parse(page);
  if (
    from > to ||
    (!can(session.roles, 'view_operations') &&
      (!session.roles.includes('WORKER') || workerId !== session.userId))
  )
    throw new Error('FORBIDDEN');
  const db = await createClient();
  const result = await db
    .from('wage_payments')
    .select(
      'id,worker_id,payment_date,amount,method,notes,created_by,created_at,wage_payment_allocations(*)',
      { count: 'exact' },
    )
    .eq('worker_id', workerId)
    .gte('payment_date', from)
    .lte('payment_date', to)
    .order('payment_date', { ascending: false })
    .order('id')
    .range((page - 1) * 20, page * 20 - 1);
  if (result.error) throw new Error('Không thể tải lịch sử trả lương.');
  return { rows: result.data, count: result.count ?? 0 };
}
