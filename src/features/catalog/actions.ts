'use server';
import { z } from 'zod';
import { managerMutation } from '@/features/shared/backend';
import { dateSchema } from '@/features/production/schemas';
import { unitPriceSchema } from '@/features/commerce/schemas';
import type { ActionResult } from '@/types/domain';
const contactSchema = z.object({
  kind: z.enum(['CUSTOMER', 'SUPPLIER']),
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().max(30).default(''),
  notes: z.string().max(1000).default(''),
  active: z.boolean().default(true),
  bank_name: z.string().trim().max(120).optional(),
  bank_account: z.string().trim().max(64).optional(),
  account_holder: z.string().trim().max(120).optional(),
  qr_path: z.string().max(200).optional(),
});
export async function saveContact(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  const v = contactSchema.safeParse(input);
  if (!v.success)
    return { success: false, message: 'Thông tin khách hàng hoặc nhà cung cấp chưa hợp lệ.' };
  return managerMutation('save_contact_payment', {
    p_bank_name: v.data.bank_name ?? null,
    p_bank_account: v.data.bank_account ?? null,
    p_account_holder: v.data.account_holder ?? null,
    p_qr_path: v.data.qr_path ?? null,
    p_kind: v.data.kind,
    p_id: v.data.id ?? null,
    p_name: v.data.name,
    p_phone: v.data.phone,
    p_notes: v.data.notes,
    p_active: v.data.active,
  });
}
const materialSchema = z
  .object({
    id: z.uuid().optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{1,32}$/),
    name: z.string().trim().min(1).max(120),
    unit: z.enum(['BUNDLE', 'KG', 'METER', 'PIECE', 'LITER']),
    is_sedge: z.boolean().default(false),
    active: z.boolean().default(true),
  })
  .refine((v) => !v.is_sedge || v.unit === 'BUNDLE');
export async function saveMaterial(input: z.input<typeof materialSchema>): Promise<ActionResult> {
  const v = materialSchema.safeParse(input);
  if (!v.success) return { success: false, message: 'Kiểm tra tên, đơn vị và loại nguyên liệu.' };
  return managerMutation('save_material', {
    p_id: v.data.id ?? null,
    p_code: v.data.code,
    p_name: v.data.name,
    p_unit: v.data.unit,
    p_sedge: v.data.is_sedge,
    p_active: v.data.active,
  });
}
const priceSchema = z.object({
  mat_type_id: z.uuid(),
  price_type: z.enum(['RETAIL', 'WHOLESALE', 'PURCHASE']),
  effective_from: dateSchema,
  unit_price: unitPriceSchema,
});
export async function addMatPrice(input: z.input<typeof priceSchema>): Promise<ActionResult> {
  const v = priceSchema.safeParse(input);
  if (!v.success)
    return { success: false, message: 'Kiểm tra loại chiếu, ngày và giá nguyên không âm.' };
  return managerMutation('add_mat_price', {
    p_mat: v.data.mat_type_id,
    p_type: v.data.price_type,
    p_date: v.data.effective_from,
    p_price: v.data.unit_price,
  });
}
const stageSchema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{1,32}$/),
  name: z.string().trim().min(1).max(120),
  active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(1000).default(0),
});
export async function saveStage(input: z.input<typeof stageSchema>): Promise<ActionResult> {
  const v = stageSchema.safeParse(input);
  if (!v.success) return { success: false, message: 'Công đoạn chưa hợp lệ.' };
  return managerMutation('save_stage', {
    p_id: v.data.id ?? null,
    p_code: v.data.code,
    p_name: v.data.name,
    p_active: v.data.active,
    p_order: v.data.sort_order,
  });
}
const categorySchema = z.object({
  id: z.uuid().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{1,32}$/),
  name: z.string().trim().min(1).max(120),
});
export async function saveExpenseCategory(
  input: z.input<typeof categorySchema>,
): Promise<ActionResult> {
  const v = categorySchema.safeParse(input);
  if (!v.success) return { success: false, message: 'Danh mục chi phí chưa hợp lệ.' };
  return managerMutation('save_expense_category', {
    p_id: v.data.id ?? null,
    p_code: v.data.code,
    p_name: v.data.name,
  });
}
