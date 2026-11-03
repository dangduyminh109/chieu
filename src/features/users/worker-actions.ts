'use server';
import { z } from 'zod';
import { usernameSchema } from '@/features/auth/schemas';
import { managerMutation } from '@/features/shared/backend';
import type { ActionResult } from '@/types/domain';
const schema = z.object({
  user_id: z.uuid(),
  skills: z.array(z.uuid()).max(100),
  active: z.boolean(),
  username: usernameSchema,
  reason: z.string().trim().min(5).max(1000),
});
export async function manageWorker(input: z.input<typeof schema>): Promise<ActionResult> {
  const v = schema.safeParse(input);
  if (!v.success)
    return { success: false, message: 'Kiểm tra tài khoản, công đoạn, tên đăng nhập và lý do.' };
  return managerMutation('manage_worker', {
    p_user: v.data.user_id,
    p_skills: v.data.skills,
    p_active: v.data.active,
    p_username: v.data.username,
    p_reason: v.data.reason,
  });
}
