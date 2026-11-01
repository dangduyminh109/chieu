'use server';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { businessDate } from '@/lib/utils';
import { mutationMessage } from '@/features/shared/errors';
import { workSchema, type WorkInput } from './schemas';
import type { ActionResult } from '@/types/domain';
export async function submitWork(input: WorkInput): Promise<ActionResult> {
  await requirePermission('submit_work');
  const v = workSchema.safeParse(input);
  if (!v.success || v.data.work_date > businessDate())
    return { success: false, message: 'Kiểm tra ngày làm việc và số lượng chiếu.' };
  const db = await createClient();
  const { data, error } = await db.rpc('submit_work', {
    p_date: v.data.work_date,
    p_stage: v.data.stage_id,
    p_mat: v.data.mat_type_id,
    p_quantity: v.data.quantity,
    p_key: v.data.idempotency_key,
    p_expected_rate: v.data.expected_rate,
  });
  if (!error) {
    revalidatePath('/production');
    revalidatePath('/');
  }
  return {
    success: !error,
    message: error ? mutationMessage(error) : 'Đã gửi công. Bạn có thể xem trong lịch sử bên dưới.',
    id: data ?? undefined,
  };
}
