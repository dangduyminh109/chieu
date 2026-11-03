'use server';
import { postDocument } from '@/features/commerce/actions';
import type { DocumentInput } from '@/features/commerce/schemas';
type Input = Omit<DocumentInput, 'kind'>;
export async function purchaseMaterials(input: Input) {
  return postDocument({ ...input, kind: 'MATERIAL_PURCHASE' });
}
export async function issueMaterials(input: Input) {
  return postDocument({ ...input, kind: 'MATERIAL_ISSUE' });
}
