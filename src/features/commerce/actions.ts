'use server';
import {
  documentSchema,
  documentPaymentSchema,
  type DocumentInput,
  type DocumentPaymentInput,
} from './schemas';
import { managerMutation } from '@/features/shared/backend';
import type { ActionResult } from '@/types/domain';
import { decimalMilli } from './amounts';
export async function postDocument(input: DocumentInput): Promise<ActionResult> {
  const result = documentSchema.safeParse(input);
  if (!result.success)
    return {
      success: false,
      message: result.error.issues[0]?.message ?? 'Thông tin chứng từ chưa hợp lệ.',
    };
  const v = result.data;
  if (['SALE', 'FINISHED_PURCHASE', 'MATERIAL_PURCHASE'].includes(v.kind)) {
    let total = 0n;
    for (const item of v.items) {
      if (item.bundles)
        total += item.bundles.reduce((sum, bundle) => sum + BigInt(bundle.purchase_price), 0n);
      else {
        const quantity = decimalMilli(item.quantity ?? '');
        if (quantity === null) return { success: false, message: 'Kiểm tra số lượng.' };
        const subtotal = quantity * BigInt(item.unit_price);
        if (subtotal % 1000n !== 0n)
          return { success: false, message: 'Số tiền của mặt hàng phải là số đồng nguyên.' };
        total += subtotal / 1000n;
      }
    }
    if (BigInt(v.amount_paid) > total)
      return { success: false, message: 'Số tiền đã thanh toán vượt tổng tiền.' };
    if (BigInt(v.amount_paid) < total && !(v.kind === 'SALE' ? v.customer_id : v.supplier_id))
      return {
        success: false,
        message:
          v.kind === 'SALE'
            ? 'Chọn khách hàng để lưu khoản còn nợ.'
            : 'Chọn nhà cung cấp để lưu khoản còn nợ.',
      };
  }
  return managerMutation('post_document_stage', {
    p_kind: v.kind,
    p_receipt_stage: v.receipt_stage,
    p_date: v.business_date,
    p_items: v.items,
    p_key: v.idempotency_key,
    p_supplier: v.supplier_id ?? null,
    p_customer: v.customer_id ?? null,
    p_sale_type: v.sale_type ?? null,
    p_category: v.expense_category_id ?? null,
    p_amount: v.amount ?? 0,
    p_paid: v.amount_paid,
    p_method: v.method,
    p_reference: v.reference ?? null,
    p_notes: v.notes,
  });
}
export async function recordDocumentPayment(input: DocumentPaymentInput): Promise<ActionResult> {
  const result = documentPaymentSchema.safeParse(input);
  if (!result.success)
    return { success: false, message: 'Kiểm tra chứng từ, ngày thanh toán và số tiền.' };
  const v = result.data;
  return managerMutation('record_document_payment', {
    p_document: v.document_id,
    p_date: v.payment_date,
    p_amount: v.amount,
    p_method: v.method,
    p_notes: v.notes,
    p_key: v.idempotency_key,
  });
}
