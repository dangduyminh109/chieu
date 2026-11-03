'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { recordExpense } from './actions';
import type { ActionResult } from '@/types/domain';

export async function recordQuickExpense(input: {
  category: string;
  amount: number;
  notes: string;
  method: 'CASH' | 'BANK';
  key: string;
}): Promise<ActionResult> {
  await requirePermission('view_operations');
  const v = z
    .object({
      category: z.enum(['SEDGE', 'THREAD', 'FABRIC', 'DYE', 'REPAIR', 'OTHER']),
      amount: z.number().int().min(1).max(1_000_000_000),
      notes: z.string().trim().max(1000),
      method: z.enum(['CASH', 'BANK']),
      key: z.uuid(),
    })
    .safeParse(input);
  if (!v.success)
    return { success: false, message: 'Kiểm tra loại chi phí, số tiền và nội dung chi.' };
  const db = await createClient();
  const category = await db
    .from('expense_categories')
    .select('id')
    .eq('code', v.data.category)
    .single();
  if (category.error)
    return { success: false, message: 'Không tải được loại chi phí. Hãy thử lại.' };
  return recordExpense({
    business_date: businessDate(),
    expense_category_id: category.data.id,
    amount: v.data.amount,
    amount_paid: v.data.amount,
    method: v.data.method,
    notes: v.data.notes,
    idempotency_key: v.data.key,
  });
}
