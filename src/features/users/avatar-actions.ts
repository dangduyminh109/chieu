'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/domain';

export async function updateAvatar(path: string): Promise<ActionResult> {
  await requireSession();
  if (!z.string().min(1).max(200).safeParse(path).success)
    return { success: false, message: 'Ảnh đại diện không hợp lệ.' };
  const db = await createClient();
  const { error } = await db.rpc('update_my_avatar', { p_path: path });
  if (!error) revalidatePath('/', 'layout');
  return {
    success: !error,
    message: error ? 'Chưa lưu được ảnh đại diện. Vui lòng thử lại.' : 'Đã cập nhật ảnh đại diện.',
  };
}
