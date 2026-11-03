'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { usernameSchema } from './schemas';
import type { ActionResult } from '@/types/domain';
const schema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});
export async function login(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { success: false, message: 'Nhập tên đăng nhập hoặc email và mật khẩu.' };
  const db = await createClient();
  let email = input.data.identifier.toLowerCase();
  const failure = { success: false, message: 'Tên đăng nhập, email hoặc mật khẩu chưa đúng.' };
  if (!email.includes('@')) {
    const username = usernameSchema.safeParse(email);
    if (!username.success || !process.env.SUPABASE_SECRET_KEY) return failure;
    const admin = createAdminClient();
    const profile = await admin
      .from('profiles')
      .select('id')
      .eq('username', username.data)
      .eq('active', true)
      .maybeSingle();
    if (profile.error || !profile.data) return failure;
    // Resolve the current Auth email only on the server; never expose the mapping.
    const account = await admin.auth.admin.getUserById(profile.data.id);
    if (account.error || !account.data.user?.email) return failure;
    email = account.data.user.email;
  } else if (!z.email().safeParse(email).success) return failure;
  const { error } = await db.auth.signInWithPassword({ email, password: input.data.password });
  if (error)
    return {
      success: false,
      message: 'Tên đăng nhập, email hoặc mật khẩu chưa đúng.',
    };
  const {
    data: { user },
  } = await db.auth.getUser();
  const profile = user
    ? await db.from('profiles').select('active').eq('id', user.id).maybeSingle()
    : null;
  if (!profile?.data?.active) {
    await db.auth.signOut();
    return {
      success: false,
      message: 'Tài khoản chưa được kích hoạt. Liên hệ quản trị viên.',
    };
  }
  redirect('/');
}
export async function logout() {
  const db = await createClient();
  await db.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const email = z.string().trim().pipe(z.email()).safeParse(form.get('email'));
  if (!email.success) return { success: false, message: 'Nhập email hợp lệ.' };
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const db = await createClient();
  try {
    await db.auth.resetPasswordForEmail(email.data, {
      redirectTo: new URL('/auth/callback?next=/reset-password', origin).toString(),
    });
  } catch {
    /* Do not reveal whether an account exists. */
  }
  return {
    success: true,
    message:
      'Nếu email có tài khoản, hướng dẫn đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư (cả mục Spam/Thư rác).',
  };
}

export async function updatePassword(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const password = form.get('password');
  const confirmPassword = form.get('confirmPassword');

  if (!password || typeof password !== 'string') {
    return { success: false, message: 'Vui lòng nhập mật khẩu mới.' };
  }
  if (password.length < 5 || password.length > 128) {
    return { success: false, message: 'Mật khẩu cần từ 5 đến 128 ký tự .' };
  }
  if (confirmPassword !== null && password !== confirmPassword) {
    return { success: false, message: 'Mật khẩu xác nhận không trùng khớp với mật khẩu mới.' };
  }

  const db = await createClient();
  const { error } = await db.auth.updateUser({ password });
  if (error) {
    return {
      success: false,
      message:
        'Không thể cập nhật mật khẩu. Phiên làm việc có thể đã hết hạn, vui lòng yêu cầu lại.',
    };
  }

  return {
    success: true,
    message: 'Mật khẩu đã được cập nhật thành công!',
  };
}
