'use server';
import { z } from 'zod';
import { managerMutation } from '@/features/shared/backend';
import type { ActionResult } from '@/types/domain';

export async function payMonthlyWages(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      worker: z.uuid(),
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      amount: z.coerce.number().int().min(1).max(1_000_000_000_000_000),
      method: z.enum(['CASH', 'BANK']),
      notes: z.string().max(900),
      key: z.uuid(),
      confirmed: z.literal('on'),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { success: false, message: 'Kiểm tra số tiền và xác nhận đã trả tiền cho thợ.' };
  const v = parsed.data;
  return managerMutation('pay_monthly_wages', {
    p_worker: v.worker,
    p_month: `${v.month}-01`,
    p_amount: v.amount,
    p_method: v.method,
    p_notes: v.notes,
    p_key: v.key,
  });
}
