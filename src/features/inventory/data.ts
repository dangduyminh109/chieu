import 'server-only';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { dateSchema } from '@/features/production/schemas';

export async function getStockMovements(input: {
  kind: 'MATERIAL' | 'FINISHED';
  itemId: string;
  from: string;
  to: string;
  page?: number;
}) {
  await requirePermission('view_operations');
  const v = z
    .object({
      kind: z.enum(['MATERIAL', 'FINISHED']),
      itemId: z.uuid(),
      from: dateSchema,
      to: dateSchema,
      page: z.number().int().min(1).max(100000).default(1),
    })
    .refine((v) => v.from <= v.to)
    .parse(input);
  const db = await createClient();
  const table = v.kind === 'MATERIAL' ? 'material_stock_movements' : 'finished_stock_movements';
  const key = v.kind === 'MATERIAL' ? 'material_id' : 'mat_type_id';
  const result = await db
    .from(table)
    .select('*', { count: 'exact' })
    .eq(key, v.itemId)
    .gte('business_date', v.from)
    .lte('business_date', v.to)
    .order('business_date', { ascending: false })
    .order('id')
    .range((v.page - 1) * 50, v.page * 50 - 1);
  if (result.error) throw new Error('Không thể tải lịch sử nhập xuất.');
  return { rows: result.data, count: result.count ?? 0 };
}
