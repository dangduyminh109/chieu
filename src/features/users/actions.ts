'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { mutationMessage } from '@/features/shared/errors';
import type { ActionResult } from '@/types/domain';
import { usernameSchema } from '@/features/auth/schemas';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createWorker(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const actor = await requirePermission('provision_users');
  const input = z
    .object({
      name: z.string().trim().min(1).max(120),
      username: usernameSchema,
      email: z.string().trim().pipe(z.email()),
      password: z.string().min(5).max(128),
      skills: z.array(z.uuid()).max(100),
      roles: z
        .array(z.enum(['ADMIN', 'OWNER', 'WORKER']))
        .min(1)
        .max(3),
    })
    .safeParse({
      name: form.get('name'),
      username: form.get('username'),
      email: form.get('email'),
      password: form.get('password'),
      skills: [...new Set(form.getAll('skills'))],
      roles: form.getAll('roles').length ? [...new Set(form.getAll('roles'))] : ['WORKER'],
    });
  if (!input.success)
    return {
      success: false,
      message: 'Nhập tên, email và mật khẩu từ 5 ký tự; chọn công đoạn hợp lệ.',
    };
  if (
    !actor.roles.includes('ADMIN') &&
    (input.data.roles.length !== 1 || input.data.roles[0] !== 'WORKER')
  )
    return {
      success: false,
      message: 'Chỉ quản trị viên được cấp vai trò chủ cơ sở hoặc quản trị viên.',
    };
  if (!process.env.SUPABASE_SECRET_KEY)
    return {
      success: false,
      message: 'Chưa cấu hình quyền tạo tài khoản trên máy chủ. Liên hệ quản trị viên.',
    };
  const admin = createAdminClient();
  const existing = await admin
    .from('profiles')
    .select('id')
    .eq('username', input.data.username)
    .maybeSingle();
  if (existing.error || existing.data)
    return {
      success: false,
      message: 'Tên đăng nhập đã được dùng hoặc chưa thể kiểm tra. Vui lòng chọn tên khác.',
    };
  const { data, error } = await admin.auth.admin.createUser({
    email: input.data.email,
    password: input.data.password,
    email_confirm: true,
    ban_duration: '876000h',
    user_metadata: { full_name: input.data.name },
  });
  if (error || !data.user)
    return {
      success: false,
      message: 'Không thể tạo tài khoản. Kiểm tra email đã tồn tại hoặc thử lại sau.',
    };
  const named = await admin
    .from('profiles')
    .update({ username: input.data.username })
    .eq('id', data.user.id);
  if (named.error)
    return {
      success: false,
      message: 'Chưa gán được tên đăng nhập. Tài khoản vẫn bị khóa; liên hệ quản trị viên.',
    };
  const assigned = await admin.rpc('provision_account', {
    p_actor: actor.userId,
    p_user: data.user.id,
    p_roles: input.data.roles,
    p_skills: input.data.roles.includes('WORKER') ? input.data.skills : [],
  });
  if (assigned.error)
    return {
      success: false,
      message:
        'Tài khoản được giữ ở trạng thái khóa do chưa phân quyền được. Nhờ quản trị viên kiểm tra trước khi tạo lại.',
    };
  const activated = await admin.auth.admin.updateUserById(data.user.id, { ban_duration: 'none' });
  revalidatePath('/users');
  return {
    success: !activated.error,
    message: activated.error
      ? 'Đã tạo và phân quyền nhưng chưa mở khóa được tài khoản. Liên hệ quản trị viên.'
      : 'Đã tạo tài khoản và phân vai trò. Cung cấp thông tin đăng nhập cho người sử dụng.',
  };
}
export async function setPassword(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireSession();
  const password = z.string().min(5).max(128).safeParse(form.get('password'));
  if (!password.success) return { success: false, message: 'Mật khẩu cần từ 5 đến 128 ký tự.' };
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
