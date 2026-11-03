'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { dateSchema } from '@/features/production/schemas';
import { mutationMessage } from '@/features/shared/errors';
import type { ActionResult } from '@/types/domain';
const schema = z.object({
  mat_type_id: z.union([z.uuid(), z.literal('')]),
  stage_id: z.uuid(),
  worker_id: z.union([z.uuid(), z.literal('')]),
  effective_from: dateSchema,
  unit_rate: z.coerce.number().int().min(0).max(1_000_000_000),
});
export async function addRate(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('manage_catalog');
  const v = schema.safeParse(Object.fromEntries(form));
  if (!v.success)
    return {
      success: false,
      message: 'Chọn loại chiếu, công đoạn, ngày và đơn giá nguyên không âm.',
    };
  const db = await createClient();
  const { error } = await db.rpc('add_labor_rate', {
    p_mat: v.data.mat_type_id || null,
    p_stage: v.data.stage_id,
    p_worker: v.data.worker_id || null,
    p_date: v.data.effective_from,
    p_rate: v.data.unit_rate,
  });
  if (!error) {
    revalidatePath('/pricing');
    revalidatePath('/production');
  }
  return { success: !error, message: mutationMessage(error) };
}
