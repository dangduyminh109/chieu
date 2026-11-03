'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { postDocument } from '@/features/commerce/actions';
import { quantitySchema } from '@/features/commerce/schemas';
import { workDateSchema } from '@/features/production/schemas';
import { decimalMilli } from '@/features/commerce/amounts';
import type { ActionResult } from '@/types/domain';

export async function saveMaterialMovement(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('view_operations');
  const parsed = z
    .object({
      material: z.uuid(),
      kind: z.enum(['MATERIAL_PURCHASE', 'MATERIAL_ISSUE']),
      date: workDateSchema,
      quantity: z.string(),
      weight: z.string(),
      price: z.coerce.number().int().min(0).max(1000000000),
      plan: z.enum(['PAID', 'PARTIAL', 'DEBT']),
      paid: z.coerce.number().int().min(0).max(1000000000000000),
      method: z.enum(['CASH', 'BANK']),
      supplier: z.union([z.uuid(), z.literal('')]),
      notes: z.string().max(1000),
      key: z.uuid(),
      bundles: z.string().max(200000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { success: false, message: 'Kiểm tra ngày, nguyên liệu và thông tin nhập/xuất.' };
  const v = parsed.data;
  const db = await createClient();
  const material = await db
    .from('materials')
    .select('is_sedge,unit')
    .eq('id', v.material)
    .eq('active', true)
    .single();
  if (material.error) return { success: false, message: 'Nguyên liệu không còn sử dụng.' };
  const buying = v.kind === 'MATERIAL_PURCHASE';
  let bundles: { weight_kg: string; purchase_price: number }[] | undefined;
  let total = 0n;
  if (material.data.is_sedge && buying) {
    let raw: unknown;
    try {
      raw = JSON.parse(v.bundles);
    } catch {
      return { success: false, message: 'Danh sách bó lát không hợp lệ.' };
    }
    const list = z
      .array(
        z.object({
          weight_kg: quantitySchema,
          purchase_price: z.number().int().min(0).max(1000000000),
        }),
      )
      .min(1)
      .max(1000)
      .safeParse(raw);
    if (!list.success)
      return { success: false, message: 'Mỗi bó lát cần cân nặng và giá tiền hợp lệ.' };
    bundles = list.data;
    total = bundles.reduce((sum, b) => sum + BigInt(b.purchase_price), 0n);
  } else {
    const quantity = decimalMilli(v.quantity);
    if (
      quantity === null ||
      (['PIECE', 'BUNDLE'].includes(material.data.unit) && quantity % 1000n !== 0n)
    )
      return { success: false, message: 'Kiểm tra số lượng theo đơn vị nguyên liệu.' };
    if (buying) {
      const amount = quantity * BigInt(v.price);
      if (amount % 1000n !== 0n)
        return { success: false, message: 'Tổng tiền phải là số đồng nguyên.' };
      total = amount / 1000n;
    }
    if (material.data.is_sedge && !quantitySchema.safeParse(v.weight).success)
      return { success: false, message: 'Nhập tổng cân nặng lát xuất dùng.' };
  }
  const paid = buying ? (v.plan === 'PAID' ? total : v.plan === 'DEBT' ? 0n : BigInt(v.paid)) : 0n;
  if (paid > total) return { success: false, message: 'Số tiền trả vượt tổng tiền mua.' };
  if (buying && paid < total && !v.supplier)
    return { success: false, message: 'Chọn nhà cung cấp để lưu khoản còn nợ.' };
  return postDocument({
    kind: v.kind,
    business_date: v.date,
    idempotency_key: v.key,
    supplier_id: buying ? v.supplier || undefined : undefined,
    amount_paid: Number(paid),
    method: v.method,
    notes: v.notes,
    items: [
      {
        material_id: v.material,
        quantity: bundles ? undefined : v.quantity,
        bundles,
        weight_kg: !buying && material.data.is_sedge ? v.weight : undefined,
        unit_price: buying && !bundles ? v.price : 0,
      },
    ],
  });
}
