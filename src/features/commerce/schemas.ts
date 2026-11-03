import { z } from 'zod';
import { dateSchema } from '@/features/production/schemas';
import { amountSchema, paymentMethodSchema } from '@/features/payroll/schemas';
export const unitPriceSchema = z.number().int().min(0).max(1_000_000_000);
export const quantitySchema = z
  .union([z.string(), z.number()])
  .transform(String)
  .refine(
    (v) => /^(0|[1-9]\d{0,6})(\.\d{1,3})?$/.test(v) && Number(v) > 0 && Number(v) <= 1_000_000,
    'Số lượng dương, tối đa 3 chữ số thập phân.',
  );
const bundleSchema = z.object({
  weight_kg: quantitySchema,
  purchase_price: unitPriceSchema,
  lon_count: z.number().int().min(0).max(1_000_000).optional(),
});
const itemSchema = z.object({
  mat_type_id: z.uuid().optional(),
  material_id: z.uuid().optional(),
  quantity: quantitySchema.optional(),
  weight_kg: quantitySchema.optional(),
  unit_price: unitPriceSchema.default(0),
  override_reason: z.string().trim().min(5).max(1000).optional(),
  bundles: z.array(bundleSchema).min(1).max(1000).optional(),
});
export const documentSchema = z
  .object({
    kind: z.enum([
      'MATERIAL_PURCHASE',
      'MATERIAL_ISSUE',
      'FINISHED_PURCHASE',
      'FINISHED_RECEIPT',
      'SALE',
      'EXPENSE',
    ]),
    business_date: dateSchema,
    receipt_stage: z.enum(['WOVEN', 'TIED', 'CUT', 'SEWN']).default('SEWN'),
    items: z.array(itemSchema).max(100),
    idempotency_key: z.uuid(),
    supplier_id: z.uuid().optional(),
    customer_id: z.uuid().optional(),
    sale_type: z.enum(['RETAIL', 'WHOLESALE']).optional(),
    expense_category_id: z.uuid().optional(),
    amount: amountSchema.optional(),
    amount_paid: z.number().int().min(0).max(1_000_000_000_000_000).default(0),
    method: paymentMethodSchema.default('CASH'),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().max(1000).default(''),
  })
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (v.kind === 'EXPENSE') {
      if (!v.expense_category_id || !v.amount || v.items.length)
        fail('Chi phí cần danh mục và số tiền, không có mặt hàng.');
    } else if (v.items.length === 0 || v.expense_category_id || v.amount)
      fail('Chứng từ cần mặt hàng hợp lệ.');
    if (v.kind === 'SALE' ? !v.sale_type : Boolean(v.sale_type)) fail('Hình thức bán chưa hợp lệ.');
    if (v.customer_id && v.kind !== 'SALE') fail('Khách hàng chỉ áp dụng cho bán hàng.');
    if (v.supplier_id && !['MATERIAL_PURCHASE', 'FINISHED_PURCHASE'].includes(v.kind))
      fail('Nhà cung cấp không phù hợp.');
    if (v.kind === 'FINISHED_RECEIPT' && (v.reference?.length ?? 0) < 3)
      fail('Nhập kho thành phẩm cần mã lô hoàn thành.');
    for (const item of v.items) {
      const material = ['MATERIAL_PURCHASE', 'MATERIAL_ISSUE'].includes(v.kind);
      if (
        material
          ? !item.material_id || Boolean(item.mat_type_id)
          : !item.mat_type_id || Boolean(item.material_id)
      )
        fail('Mặt hàng không phù hợp với loại chứng từ.');
      if (!item.quantity && !item.bundles) fail('Thiếu số lượng.');
      if (item.bundles && v.kind !== 'MATERIAL_PURCHASE')
        fail('Bó lát chỉ dùng trong mua nguyên liệu.');
      if (!material && (item.bundles || item.weight_kg || !Number.isInteger(Number(item.quantity))))
        fail('Số chiếu phải là số nguyên.');
      if (
        ['MATERIAL_ISSUE', 'FINISHED_RECEIPT'].includes(v.kind) &&
        (item.unit_price !== 0 || v.amount_paid !== 0)
      )
        fail('Nhập hoàn thành và xuất sử dụng không ghi tiền mua bán.');
    }
  });
export type DocumentInput = z.input<typeof documentSchema>;
export const documentPaymentSchema = z.object({
  document_id: z.uuid(),
  payment_date: dateSchema,
  amount: amountSchema,
  method: paymentMethodSchema,
  notes: z.string().max(1000).default(''),
  idempotency_key: z.uuid(),
});
export type DocumentPaymentInput = z.input<typeof documentPaymentSchema>;
