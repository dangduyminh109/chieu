'use server';
import { postDocument } from '@/features/commerce/actions';
import type { DocumentInput } from '@/features/commerce/schemas';
type Input = Omit<DocumentInput, 'kind'>;
export async function receiveFinishedGoods(input: Input) {
  return postDocument({ ...input, kind: 'FINISHED_RECEIPT' });
}
export async function purchaseFinishedMats(input: Input) {
  return postDocument({ ...input, kind: 'FINISHED_PURCHASE' });
}
