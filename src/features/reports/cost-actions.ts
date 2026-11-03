'use server';
import { z } from 'zod';
import { managerMutation } from '@/features/shared/backend';
import type { ActionResult } from '@/types/domain';
export async function saveSaleCost(_: ActionResult, form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      item: z.uuid(),
      cost: z.coerce.number().int().min(0).max(1000000000),
      reason: z.string().trim().min(5).max(1000),
      key: z.uuid(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { success: false, message: 'Nhập giá vốn mỗi chiếc và lý do ít nhất 5 ký tự.' };
  const v = parsed.data;
  return managerMutation('set_sale_item_cost', {
    p_item: v.item,
    p_cost: v.cost,
    p_reason: v.reason,
    p_key: v.key,
  });
}
