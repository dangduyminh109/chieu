import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const allowed = ['invite', 'recovery', 'email'];
  if (token && type && allowed.includes(type)) {
    const db = await createClient();
    const { error } = await db.auth.verifyOtp({ token_hash: token, type: type as EmailOtpType });
    if (!error) return NextResponse.redirect(new URL('/profile', request.url));
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
}
