'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/domain';
const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });
export async function login(_previous: ActionResult, form: FormData): Promise<ActionResult> {
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success) return { success: false, message: 'Nhập email và mật khẩu hợp lệ.' };
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(input.data);
  if (error)
    return {
      success: false,
      message: 'Email hoặc mật khẩu chưa đúng, hoặc tài khoản chưa được kích hoạt.',
    };
  redirect('/');
}
export async function logout() {
  const db = await createClient();
  await db.auth.signOut();
  redirect('/login');
}
