'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { mutationMessage } from '@/features/shared/errors';
import type { ActionResult } from '@/types/domain';
export async function confirmWageReceipt(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  await requirePermission('submit_work');
  const v = z
    .object({
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      amount: z.string().regex(/^[1-9]\d{0,17}$/),
      key: z.uuid(),
      confirmed: z.literal('on'),
    })
    .safeParse({
      month: form.get('month'),
      amount: form.get('amount'),
      key: form.get('key'),
      confirmed: form.get('confirmed'),
    });
  if (!v.success)
    return { success: false, message: 'Hãy xác nhận bạn đã thực sự nhận đủ số tiền hiển thị.' };
  const db = await createClient();
  const { error } = await db.rpc('confirm_monthly_wage_receipt', {
    p_month: `${v.data.month}-01`,
    p_expected: v.data.amount,
    p_key: v.data.key,
  });
  if (!error) revalidatePath('/', 'layout');
  return {
    success: !error,
    message:
      error?.message === 'WAGE_RECEIPT_CHANGED'
        ? 'Tiền công đã thay đổi. Tải lại trang để kiểm tra trước khi xác nhận.'
        : error
          ? mutationMessage(error)
          : 'Đã lưu xác nhận nhận lương.',
  };
}
