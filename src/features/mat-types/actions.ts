'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { mutationMessage } from '@/features/shared/errors';
import type { ActionResult } from '@/types/domain';
const price = z.coerce.number().int().min(0).max(1000000000);
const schema = z.object({
  sale_price: price,
  cost_price: z.union([z.literal('').transform(() => null), price]).optional(),
  weaving_rate: price,
  sewing_rate: price,
  cutting_rate: price,
  tying_rate: price,
  id: z.union([z.uuid(), z.literal('')]),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{0,32}$/),
  name: z.string().trim().min(1).max(120),
  dimensions: z.string().max(120),
  description: z.string().max(1000),
  active: z.boolean(),
  image_path: z.string().max(200).optional(),
});
export async function saveMat(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('manage_catalog');
  const input = schema.safeParse({
    ...Object.fromEntries(form),
    active: form.get('active') === 'on',
  });
  if (!input.success)
    return { success: false, message: 'Kiểm tra tên, giá bán, giá vốn và tiền công.' };
  const v = input.data;
  const db = await createClient();
  const { error } = await db.rpc('save_mat_catalog_cost', {
    p_cost: v.cost_price ?? null,
    p_cost_provided: form.has('cost_price'),
    p_image_path: v.image_path ?? null,
    p_sale: v.sale_price,
    p_weaving: v.weaving_rate,
    p_sewing: v.sewing_rate,
    p_cutting: v.cutting_rate,
    p_tying: v.tying_rate,
    p_id: v.id || null,
    p_code: v.code,
    p_name: v.name,
    p_dimensions: v.dimensions,
    p_description: v.description,
    p_active: v.active,
  });
  if (!error) {
    revalidatePath('/', 'layout');
  }
  return { success: !error, message: mutationMessage(error) };
}
export async function deleteMat(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('delete_records');
  const id = z.uuid().safeParse(form.get('id'));
  if (!id.success) return { success: false, message: 'Loại chiếu không hợp lệ.' };
  const db = await createClient();
  const { error } = await db.rpc('delete_mat', { p_id: id.data });
  if (!error) revalidatePath('/', 'layout');
  return {
    success: !error,
    message: error ? mutationMessage(error) : 'Đã xóa loại chiếu chưa sử dụng.',
  };
}
