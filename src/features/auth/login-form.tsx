'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { UserRound, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { login } from '@/features/auth/actions';
import type { ActionResult } from '@/types/domain';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 w-full font-bold max-sm:min-h-10"
    >
      {pending ? 'Đang đăng nhập…' : 'Đăng nhập'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(login, {
    success: false,
    message: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (state.message && !state.success) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="identifier" className="block text-sm font-semibold text-foreground">
          Tên đăng nhập hoặc email
        </label>
        <div className="relative">
          <UserRound
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            required
            placeholder="Nhập username hoặc email"
            autoCapitalize="none"
            spellCheck={false}
            style={{ paddingLeft: '2.5rem' }}
            className="w-full rounded-xl border border-border bg-white py-3 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-foreground">
          Mật khẩu
        </label>
        <div className="relative">
          <Lock
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            maxLength={200}
            required
            placeholder="Nhập mật khẩu"
            style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
            className="w-full rounded-xl border border-border bg-white py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Error message */}
      <div aria-live="polite">
        {state.message && !state.success && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-destructive">
            {state.message}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
