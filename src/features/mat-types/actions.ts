'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { mutationMessage } from '@/features/shared/errors';
import type { ActionResult } from '@/types/domain';
const schema = z.object({
  id: z.union([z.uuid(), z.literal('')]),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,32}$/),
  name: z.string().trim().min(1).max(120),
  dimensions: z.string().max(120),
  description: z.string().max(1000),
  active: z.boolean(),
});
export async function saveMat(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('manage_catalog');
  const input = schema.safeParse({
    ...Object.fromEntries(form),
    active: form.get('active') === 'on',
  });
  if (!input.success)
    return { success: false, message: 'Kiểm tra tên, mã loại chiếu và độ dài thông tin.' };
  const v = input.data;
  const db = await createClient();
  const { error } = await db.rpc('save_mat', {
    p_id: v.id || null,
    p_code: v.code,
    p_name: v.name,
    p_dimensions: v.dimensions,
    p_description: v.description,
    p_active: v.active,
  });
  if (!error) {
    revalidatePath('/mat-types');
    revalidatePath('/production');
  }
  return { success: !error, message: mutationMessage(error) };
}
export async function deleteMat(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('manage_catalog');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { success: false, message: 'Loại chiếu không hợp lệ.' };
  const db = await createClient();
  const { error } = await db.rpc('delete_mat', { p_id: id.data });
  if (!error) revalidatePath('/mat-types');
  return { success: !error, message: error ? mutationMessage(error) : 'Đã xóa loại chiếu.' };
}
