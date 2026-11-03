'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { managerMutation } from '@/features/shared/backend';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { mutationMessage } from '@/features/shared/errors';
import { workSchema } from './schemas';
import type { ActionResult } from '@/types/domain';
const reviewSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().min(1),
    decision: z.enum(['APPROVE', 'REJECT', 'LOCK']),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.decision !== 'REJECT' || (v.reason?.length ?? 0) >= 5);
export async function reviewWork(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  const v = reviewSchema.safeParse(input);
  if (!v.success)
    return { success: false, message: 'Chọn công, phiên bản và lý do từ chối (ít nhất 5 ký tự).' };
  return managerMutation('review_work', {
    p_id: v.data.id,
    p_version: v.data.version,
    p_decision: v.data.decision,
    p_reason: v.data.reason ?? null,
  });
}
const resubmitSchema = workSchema
  .omit({ idempotency_key: true })
  .extend({ id: z.uuid(), version: z.number().int().min(1) });
export async function resubmitWork(input: z.input<typeof resubmitSchema>): Promise<ActionResult> {
  await requirePermission('submit_work');
  const v = resubmitSchema.safeParse(input);
  if (!v.success) return { success: false, message: 'Thông tin công chưa hợp lệ.' };
  const db = await createClient();
  const { data, error } = await db.rpc('resubmit_work', {
    p_id: v.data.id,
    p_version: v.data.version,
    p_date: v.data.work_date,
    p_stage: v.data.stage_id,
    p_mat: v.data.mat_type_id,
    p_quantity: v.data.quantity,
    p_expected_rate: v.data.expected_rate,
  });
  if (!error) revalidatePath('/', 'layout');
  return {
    success: !error,
    message: mutationMessage(error),
    id: typeof data === 'string' ? data : undefined,
  };
}
