'use server';
import { postDocument, recordDocumentPayment } from '@/features/commerce/actions';
import type { DocumentInput, DocumentPaymentInput } from '@/features/commerce/schemas';
export async function createSale(input: Omit<DocumentInput, 'kind'>) {
  return postDocument({ ...input, kind: 'SALE' });
}
export async function recordSalePayment(input: DocumentPaymentInput) {
  return recordDocumentPayment(input);
}
