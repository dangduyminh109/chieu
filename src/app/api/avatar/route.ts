import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const headers = {
    'Cache-Control': 'private, no-store',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  };
  const session = await getSession();
  if (!session) return new Response(null, { status: 401, headers });
  const path = new URL(request.url).searchParams.get('path');
  if (!path || !/^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp)$/.test(path))
    return new Response(null, { status: 404, headers });
  const db = await createClient();
  const { data, error } = await db.storage.from('avatars').download(path);
  if (error || !data || !['image/jpeg', 'image/png', 'image/webp'].includes(data.type))
    return new Response(null, { status: 404, headers });
  return new Response(data, { headers: { ...headers, 'Content-Type': data.type } });
}
