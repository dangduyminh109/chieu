'use server';
import { saveContact, saveMaterial } from '@/features/catalog/actions';
import { recordDocumentPayment } from './actions';
import type { ActionResult } from '@/types/domain';
import type { Material } from './business-types';

export async function saveContactForm(_: ActionResult, form: FormData): Promise<ActionResult> {
  return saveContact({
    kind: String(form.get('kind')) as 'CUSTOMER' | 'SUPPLIER',
    id: String(form.get('id') ?? '') || undefined,
    name: String(form.get('name') ?? ''),
    phone: String(form.get('phone') ?? ''),
    notes: String(form.get('notes') ?? ''),
    bank_name: form.has('bank_name') ? String(form.get('bank_name') ?? '') : undefined,
    bank_account: form.has('bank_account') ? String(form.get('bank_account') ?? '') : undefined,
    account_holder: form.has('account_holder')
      ? String(form.get('account_holder') ?? '')
      : undefined,
    qr_path: form.has('qr_path') ? String(form.get('qr_path') ?? '') : undefined,
    active: form.get('active') === 'on',
  });
}
export async function saveMaterialForm(_: ActionResult, form: FormData): Promise<ActionResult> {
  const id = String(form.get('id') ?? '');
  return saveMaterial({
    id: id || undefined,
    code: String(form.get('code') || `NL_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`),
    name: String(form.get('name') ?? ''),
    unit: String(form.get('unit')) as Material['unit'],
    is_sedge: form.get('is_sedge') === 'on',
    active: form.get('active') === 'on',
  });
}
export async function recordPaymentForm(_: ActionResult, form: FormData): Promise<ActionResult> {
  if (form.get('confirmed') !== 'on')
    return { success: false, message: 'Xác nhận đã nhận hoặc trả tiền trước khi lưu.' };
  return recordDocumentPayment({
    document_id: String(form.get('document_id')),
    payment_date: String(form.get('date')),
    amount: Number(form.get('amount')),
    method: String(form.get('method')) as 'CASH' | 'BANK',
    notes: String(form.get('notes') ?? ''),
    idempotency_key: String(form.get('key')),
  });
}
