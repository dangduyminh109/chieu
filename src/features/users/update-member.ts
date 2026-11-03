'use server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/session';
import { usernameSchema } from '@/features/auth/schemas';
import { managerMutation } from '@/features/shared/backend';
import type { ActionResult } from '@/types/domain';

export async function updateMember(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requirePermission('provision_users');
  const v = z
    .object({
      id: z.uuid(),
      name: z.string().trim().min(1).max(120),
      username: usernameSchema,
      phone: z.string().max(30),
      roles: z
        .array(z.enum(['ADMIN', 'OWNER', 'WORKER']))
        .min(1)
        .max(3),
      skills: z.array(z.uuid()).max(100),
      active: z.boolean(),
      zero: z.boolean(),
      reason: z.string().trim().min(5).max(1000),
    })
    .safeParse({
      id: form.get('id'),
      name: form.get('name'),
      username: form.get('username'),
      phone: form.get('phone') ?? '',
      roles: actor.roles.includes('ADMIN') ? [...new Set(form.getAll('roles'))] : ['WORKER'],
      skills: [...new Set(form.getAll('skills'))],
      active: form.get('active') === 'on',
      zero: actor.roles.includes('ADMIN') && form.get('zero') === 'on',
      reason: form.get('reason'),
    });
  if (!v.success)
    return {
      success: false,
      message: 'Kiểm tra tên, username, vai trò và lý do thay đổi (ít nhất 5 ký tự).',
    };
  return managerMutation('update_member', {
    p_user: v.data.id,
    p_name: v.data.name,
    p_username: v.data.username,
    p_phone: v.data.phone,
    p_roles: v.data.roles,
    p_skills: v.data.roles.includes('WORKER') ? v.data.skills : [],
    p_active: v.data.active,
    p_zero: v.data.zero,
    p_reason: v.data.reason,
  });
}
