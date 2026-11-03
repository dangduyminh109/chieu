'use server';
import { wagePaymentSchema, type WagePaymentInput } from './schemas';
import { managerMutation } from '@/features/shared/backend';
import type { ActionResult } from '@/types/domain';
export async function payWages(input: WagePaymentInput): Promise<ActionResult> {
  const v = wagePaymentSchema.safeParse(input);
  if (!v.success)
    return { success: false, message: 'Kiểm tra người nhận, ngày, số tiền và phân bổ công.' };
  return managerMutation('pay_wages', {
    p_worker: v.data.worker_id,
    p_date: v.data.payment_date,
    p_amount: v.data.amount,
    p_method: v.data.method,
    p_notes: v.data.notes,
    p_allocations: v.data.allocations,
    p_key: v.data.idempotency_key,
  });
}
