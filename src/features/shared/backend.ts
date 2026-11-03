import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { mutationMessage } from './errors';
import type { ActionResult } from '@/types/domain';

/** Called only from validated Server Actions; RPC repeats all authorization. */
export async function managerMutation(
  name: string,
  args: Record<string, unknown>,
): Promise<ActionResult> {
  await requirePermission('view_operations');
  const db = await createClient();
  const { data, error } = await db.rpc(name, args);
  if (!error) {
    revalidatePath('/', 'layout');
  }
  return {
    success: !error,
    message: mutationMessage(error),
    id: typeof data === 'string' ? data : undefined,
  };
}
