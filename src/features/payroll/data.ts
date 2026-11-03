import 'server-only';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import { dateSchema } from '@/features/production/schemas';
export interface WageStatement {
  approved: string;
  allocated: string;
  unpaid: string;
}
export async function getWageStatement(
  workerId: string,
  from: string,
  to: string,
): Promise<WageStatement> {
  const session = await requireSession();
  z.uuid().parse(workerId);
  dateSchema.parse(from);
  dateSchema.parse(to);
  if (
    from > to ||
    (!can(session.roles, 'view_operations') &&
      (!session.roles.includes('WORKER') || workerId !== session.userId))
  )
    throw new Error('FORBIDDEN');
  const db = await createClient();
  const { data, error } = await db.rpc('wage_statement', {
    p_worker: workerId,
    p_from: from,
    p_to: to,
  });
  if (error) throw new Error('Không thể tải bảng công lương.');
  return data as WageStatement;
}
