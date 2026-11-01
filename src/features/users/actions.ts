'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { mutationMessage } from '@/features/shared/errors';
import type { ActionResult } from '@/types/domain';
export async function setPassword(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  const password = z.string().min(12).max(128).safeParse(form.get('password'));
  if (!password.success) return { success: false, message: 'Mật khẩu cần từ 12 đến 128 ký tự.' };
  const db = await createClient();
  const { error } = await db.auth.updateUser({ password: password.data });
  return {
    success: !error,
    message: error
      ? 'Chưa đổi được mật khẩu. Vui lòng đăng nhập lại hoặc liên hệ quản trị viên.'
      : 'Đã lưu mật khẩu mới.',
  };
}
export async function updateProfile(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  const v = z
    .object({ name: z.string().trim().min(1).max(120), phone: z.string().max(30) })
    .safeParse(Object.fromEntries(form));
  if (!v.success) return { success: false, message: 'Nhập tên và số điện thoại hợp lệ.' };
  const db = await createClient();
  const { error } = await db.rpc('update_my_profile', {
    p_name: v.data.name,
    p_phone: v.data.phone,
  });
  if (!error) revalidatePath('/', 'layout');
  return { success: !error, message: mutationMessage(error) };
}
export async function configureMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requirePermission('manage_users');
  const v = z
    .object({
      id: z.uuid(),
      roles: z.array(z.enum(['ADMIN', 'OWNER', 'WORKER'])),
      skills: z.array(z.uuid()),
      zero: z.boolean(),
      active: z.boolean(),
      reason: z.string().trim().min(5).max(500),
    })
    .safeParse({
      id: form.get('id'),
      roles: form.getAll('roles'),
      skills: form.getAll('skills'),
      zero: form.get('zero') === 'on',
      active: form.get('active') === 'on',
      reason: form.get('reason'),
    });
  if (!v.success)
    return {
      success: false,
      message: 'Kiểm tra quyền, công đoạn và lý do thay đổi (ít nhất 5 ký tự).',
    };
  const db = await createClient();
  const { error } = await db.rpc('configure_member', {
    p_user: v.data.id,
    p_roles: v.data.roles,
    p_skills: v.data.skills,
    p_zero: v.data.zero,
    p_active: v.data.active,
    p_reason: v.data.reason,
  });
  if (!error) revalidatePath('/users');
  return { success: !error, message: mutationMessage(error) };
}
