'use server';
import { z } from 'zod';
import { getMatPrice } from '@/features/commerce/data';
import { managerMutation } from '@/features/shared/backend';
import type { ActionResult } from '@/types/domain';
export async function getSuggestedSalePrice(
  matId: string,
  type: 'RETAIL' | 'WHOLESALE',
  date: string,
) {
  const price = await getMatPrice(matId, type, date);
  return price ? Number(price.unit_price) : null;
}
export async function overrideWorkRate(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const v = z
    .object({
      id: z.uuid(),
      version: z.coerce.number().int().min(1),
      rate: z.coerce.number().int().min(0).max(1000000000),
      reason: z.string().trim().min(5).max(1000),
    })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { success: false, message: 'Kiểm tra đơn giá công và lý do điều chỉnh.' };
  return managerMutation('override_work_rate', {
    p_id: v.data.id,
    p_version: v.data.version,
    p_rate: v.data.rate,
    p_reason: v.data.reason,
  });
}
