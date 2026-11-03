import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient, isConfigured } from '@/lib/supabase/server';
import { can, type Permission } from '@/lib/permissions';
import type { Profile, Role } from '@/types/domain';
export const getSession = cache(async () => {
  if (!isConfigured()) return null;
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const [profile, roles, skills] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    db.from('user_roles').select('role').eq('user_id', user.id),
    db.from('worker_skills').select('stage_id').eq('user_id', user.id),
  ]);
  if (profile.error || roles.error || skills.error)
    throw new Error('Không thể tải tài khoản. Vui lòng thử lại.');
  if (!profile.data?.active) return null;
  return {
    userId: user.id,
    profile: profile.data as Profile,
    roles: roles.data.map((r) => r.role) as Role[],
    skills: skills.data.map((s) => s.stage_id as string),
  };
});
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}
export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!can(session.roles, permission)) throw new Error('FORBIDDEN');
  return session;
}
