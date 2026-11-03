'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { businessDate } from '@/lib/utils';
import { managerMutation } from '@/features/shared/backend';
import { postDocument } from '@/features/commerce/actions';
import type { ActionResult } from '@/types/domain';

export async function saveMatStock(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('view_operations');
  const parsed = z
    .object({
      mat: z.uuid(),
      stage: z.enum(['WOVEN', 'TIED', 'CUT', 'SEWN']),
      quantity: z.coerce.number().int().min(1).max(1000000),
      key: z.uuid(),
      mode: z.enum(['ADD', 'ADVANCE']),
      notes: z.string().max(1000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { success: false, message: 'Kiểm tra loại chiếu, tình trạng và số lượng.' };
  const v = parsed.data;
  if (v.mode === 'ADVANCE')
    return managerMutation('advance_mat_stage', {
      p_mat: v.mat,
      p_from: v.stage,
      p_quantity: v.quantity,
      p_date: businessDate(),
      p_key: v.key,
    });
  return postDocument({
    kind: 'FINISHED_RECEIPT',
    receipt_stage: v.stage,
    business_date: businessDate(),
    reference: `MANUAL-${v.key}`,
    notes: v.notes,
    items: [{ mat_type_id: v.mat, quantity: v.quantity, unit_price: 0 }],
    idempotency_key: v.key,
    amount_paid: 0,
  });
}
