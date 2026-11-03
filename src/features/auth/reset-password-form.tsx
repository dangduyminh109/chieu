'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { updatePassword } from '@/features/auth/actions';
import type { ActionResult } from '@/types/domain';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 w-full font-bold max-sm:min-h-10"
    >
      {pending ? 'Đang cập nhật mật khẩu…' : 'Lưu mật khẩu mới'}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(updatePassword, {
    success: false,
    message: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  if (state.success) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 size={26} aria-hidden />
          </div>
          <h2 className="text-base font-bold text-foreground">Đổi mật khẩu thành công!</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Mật khẩu mới của bạn đã được cập nhật an toàn vào hệ thống.
          </p>
        </div>

        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-base font-bold text-white transition-colors hover:bg-primary/90"
        >
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* New password */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-semibold text-foreground">
          Mật khẩu mới
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
            autoComplete="new-password"
            minLength={5}
            maxLength={128}
            required
            placeholder="Tối thiểu 5 ký tự"
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

      {/* Confirm password */}
      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="block text-sm font-semibold text-foreground">
          Xác nhận mật khẩu mới
        </label>
        <div className="relative">
          <Lock
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            minLength={5}
            maxLength={128}
            required
            placeholder="Nhập lại mật khẩu mới"
            style={{ paddingLeft: '2.5rem', paddingRight: '3rem' }}
            className="w-full rounded-xl border border-border bg-white py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showConfirmPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground">
        <ShieldCheck size={16} className="shrink-0 text-primary" aria-hidden />
        <span>Mật khẩu an toàn cần có tối thiểu 5 ký tự.</span>
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

