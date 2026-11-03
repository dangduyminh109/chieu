'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Mail, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requestPasswordReset } from '@/features/auth/actions';
import type { ActionResult } from '@/types/domain';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="mt-2 w-full font-bold max-sm:min-h-10"
    >
      {pending ? 'Đang gửi hướng dẫn…' : 'Gửi liên kết đặt lại'}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<ActionResult, FormData>(requestPasswordReset, {
    success: false,
    message: '',
  });

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
          <h2 className="text-base font-bold text-foreground">Đã gửi yêu cầu thành công</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {state.message}
          </p>
        </div>

        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-base font-bold text-white transition-colors hover:bg-primary/90"
        >
          Quay lại đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-semibold text-foreground">
          Email tài khoản
        </label>
        <div className="relative">
          <Mail
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Nhập email của tài khoản"
            style={{ paddingLeft: '2.5rem' }}
            className="w-full rounded-xl border border-border bg-white py-3 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
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

