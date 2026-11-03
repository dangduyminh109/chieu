'use server';
import { postDocument } from '@/features/commerce/actions';
import type { DocumentInput } from '@/features/commerce/schemas';
export async function recordExpense(input: Omit<DocumentInput, 'kind' | 'items'>) {
  return postDocument({ ...input, kind: 'EXPENSE', items: [] });
}
